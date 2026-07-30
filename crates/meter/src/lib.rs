//! fuel 計装: core wasm に決定論的な命令数カウンタを差し込む。
//!
//! ブラウザは wasmtime の fuel 計量を持たないため、jco transpile 済みの
//! core wasm を変換して同等の計量を得る（pages/content/docs/architecture.md の
//! 設計判断の実装）。変換内容:
//!
//! - mutable i64 global `zv.fuel` を **import** に追加する（ホスト側が
//!   `WebAssembly.Global` を注入し、decide 前に予算をセット・後に残量を読む）
//! - すべてのローカル関数の各命令列（block / loop / if の中身）の先頭で
//!   「fuel -= 命令数; if fuel < 0 { unreachable }」を実行する
//!
//! 計量の性質:
//! - **決定論的**（実行時間ではなく静的な命令数。同じ実行経路 → 同じ消費）
//! - loop の本体先頭でも課金するので、無限ループは必ず fuel 切れ trap で止まる
//! - 命令列に入った時点で列全体ぶんを前払いするため、途中で br で抜けると
//!   実行しなかった命令も課金される（過大方向の近似。単調で決定論的）
//! - wasmtime の計量とはスケールが完全一致しないため、fuel が効く域では
//!   ネイティブとブラウザの歴史は分かれる（架構 doc に記載の既知の性質）

use walrus::ir::{BinaryOp, Instr, InstrSeqId, Value};
use walrus::{FunctionBuilder, GlobalId, LocalFunction, Module, ValType};

/// 計装済みモジュールを返す。既に `zv.fuel` を import していれば何もしない
pub fn meter(bytes: &[u8]) -> anyhow::Result<Vec<u8>> {
    let mut module = Module::from_buffer(bytes)?;
    if module
        .imports
        .iter()
        .any(|i| i.module == "zv" && i.name == "fuel")
    {
        return Ok(bytes.to_vec());
    }
    let (fuel, _) = module.add_import_global("zv", "fuel", ValType::I64, true, false);

    let func_ids: Vec<_> = module.funcs.iter_local().map(|(id, _)| id).collect();
    for fid in func_ids {
        let func = module.funcs.get_mut(fid).kind.unwrap_local_mut();
        instrument_function(func, fuel);
    }
    Ok(module.emit_wasm())
}

/// 関数内の全命令列を集めて（id, 命令数）、それぞれの先頭に課金コードを差し込む
fn instrument_function(func: &mut LocalFunction, fuel: GlobalId) {
    let mut seqs: Vec<(InstrSeqId, u64)> = Vec::new();
    let mut stack = vec![func.entry_block()];
    while let Some(id) = stack.pop() {
        let seq = func.block(id);
        seqs.push((id, seq.instrs.len() as u64));
        for (instr, _) in &seq.instrs {
            match instr {
                Instr::Block(b) => stack.push(b.seq),
                Instr::Loop(l) => stack.push(l.seq),
                Instr::IfElse(ie) => {
                    stack.push(ie.consequent);
                    stack.push(ie.alternative);
                }
                _ => {}
            }
        }
    }

    let builder: &mut FunctionBuilder = func.builder_mut();
    for (seq_id, cost) in seqs {
        if cost == 0 {
            continue;
        }
        // fuel 切れで trap する子命令列（if の then / else）
        let trap_seq = {
            let mut b = builder.dangling_instr_seq(None);
            b.unreachable();
            b.id()
        };
        let cont_seq = builder.dangling_instr_seq(None).id();
        let mut seq = builder.instr_seq(seq_id);
        // 先頭に逆順で挿入: fuel -= cost; if (fuel < 0) unreachable
        seq.global_get_at(0, fuel);
        seq.const_at(1, Value::I64(cost as i64));
        seq.binop_at(2, BinaryOp::I64Sub);
        seq.global_set_at(3, fuel);
        seq.global_get_at(4, fuel);
        seq.const_at(5, Value::I64(0));
        seq.binop_at(6, BinaryOp::I64LtS);
        seq.instr_at(
            7,
            walrus::ir::IfElse {
                consequent: trap_seq,
                alternative: cont_seq,
            },
        );
    }
}

#[cfg(feature = "web")]
mod web {
    use wasm_bindgen::prelude::*;

    /// ブラウザ内計装（アップロード brain 用）。失敗は JS 例外
    #[wasm_bindgen(js_name = meterFuel)]
    pub fn meter_fuel(bytes: &[u8]) -> Result<Vec<u8>, JsError> {
        super::meter(bytes).map_err(|e| JsError::new(&e.to_string()))
    }
}
