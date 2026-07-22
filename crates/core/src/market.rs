//! 板（指値注文）のマッチング（pages/content/docs/market.md）。
//!
//! - resource ペアごとの板。**価格優先、同価格内はシード付きシャッフル**
//!   （時間優先は decide の呼び出し順が情報チャネルになるため禁止）。
//! - 約定価格は両者の指値の**中点**（同時手番なので maker/taker の区別が無い）。
//! - 板は**記名**。今月 post された全注文が来月の snapshot.market（公開気配）になる。
//! - 実行は在庫を上限にキャップ。partial=false の注文は全量約定できない場合スキップ。

use crate::brain::{Event, StandingOrder};
use crate::rng::hash4;
use crate::state::World;
use crate::{HumanId, Qty};
use std::collections::BTreeMap;

/// マッチング内部の注文表現（resource は内部 index）
struct OrderRec {
    hid: HumanId,
    give: usize,
    give_rem: Qty,
    want_amt: Qty,
    /// 元の give 量（価格 = want_amt / give_orig）
    give_orig: Qty,
    partial: bool,
    /// 同価格内の順序を決めるシード付きシャッフルキー
    tie: u64,
}

impl World {
    /// 月内解決: 板マッチング。orders は (human-id, commit 順) で集めた standing orders。
    /// 呼び出し前に teach/learn・conditional-give（M3）が解決されている前提。
    pub(crate) fn resolve_board(&mut self, month: u32, orders: Vec<(HumanId, StandingOrder)>) {
        // 気配の公開（来月の snapshot.market）。post された全注文を記名で載せる
        self.last_quotes.clear();

        // ペア (min,max) → (x 側: give==min, y 側: give==max)
        let mut books: BTreeMap<(usize, usize), (Vec<OrderRec>, Vec<OrderRec>)> = BTreeMap::new();
        for (k, (hid, order)) in orders.into_iter().enumerate() {
            let StandingOrder::Limit {
                give_resource,
                give_amount,
                want_resource,
                want_amount,
                partial,
            } = order
            else {
                continue; // conditional-give は resolve_conditional_gives で処理済み
            };
            let (Some(&gi), Some(&wi)) = (
                self.laws.index_of_id.get(&give_resource),
                self.laws.index_of_id.get(&want_resource),
            ) else {
                continue;
            };
            if gi == wi || give_amount == 0 || want_amount == 0 {
                continue;
            }
            self.last_quotes
                .push((hid, gi, give_amount, wi, want_amount));
            let rec = OrderRec {
                hid,
                give: gi,
                give_rem: give_amount,
                want_amt: want_amount,
                give_orig: give_amount,
                partial,
                tie: hash4(self.seed, 0x0B0A, month as u64, hid ^ ((k as u64) << 32)),
            };
            let key = (gi.min(wi), gi.max(wi));
            let entry = books.entry(key).or_default();
            if gi == key.0 {
                entry.0.push(rec);
            } else {
                entry.1.push(rec);
            }
        }

        for ((_x, _y), (mut xy, mut yx)) in books {
            // 価格優先（安い順）、同価格はシード付きシャッフル
            let sort = |v: &mut Vec<OrderRec>| {
                v.sort_by(|a, b| {
                    let pa = (a.want_amt as u128) * (b.give_orig as u128);
                    let pb = (b.want_amt as u128) * (a.give_orig as u128);
                    pa.cmp(&pb).then(a.tie.cmp(&b.tie))
                });
            };
            sort(&mut xy);
            sort(&mut yx);

            let (mut i, mut j) = (0usize, 0usize);
            while i < xy.len() && j < yx.len() {
                let (a, b) = (&xy[i], &yx[j]);
                // 交差条件: price_a(y/x) <= 1/price_b ⇔ wa*wb <= ga*gb
                let cross = (a.want_amt as u128) * (b.want_amt as u128)
                    <= (a.give_orig as u128) * (b.give_orig as u128);
                if !cross {
                    break; // 双方とも価格順なので、best 同士が交差しなければ終了
                }
                // 在庫キャップ
                let inv_a = self
                    .humans
                    .get(&a.hid)
                    .and_then(|h| h.inventory.get(&a.give).copied())
                    .unwrap_or(0);
                let inv_b = self
                    .humans
                    .get(&b.hid)
                    .and_then(|h| h.inventory.get(&b.give).copied())
                    .unwrap_or(0);
                let ga = a.give_rem.min(inv_a);
                let gb = b.give_rem.min(inv_b);
                if ga == 0 {
                    i += 1;
                    continue;
                }
                if gb == 0 {
                    j += 1;
                    continue;
                }
                // 約定レート（y per x）= 中点: num/den
                let num = (a.want_amt as u128) * (b.want_amt as u128)
                    + (a.give_orig as u128) * (b.give_orig as u128);
                let den = 2u128 * (a.give_orig as u128) * (b.want_amt as u128);
                // b の y 供給で買える x 量
                let x_from_b = ((gb as u128) * den / num.max(1)) as Qty;
                let x_trade = ga.min(x_from_b);
                let y_trade = ((x_trade as u128) * num / den.max(1)) as Qty;
                if x_trade == 0 || y_trade == 0 || y_trade > gb {
                    // 端数で成立しない: 小さい側を進める
                    if x_from_b < ga {
                        j += 1;
                    } else {
                        i += 1;
                    }
                    continue;
                }
                // partial=false は全量約定のみ
                if !a.partial && x_trade < a.give_rem {
                    i += 1;
                    continue;
                }
                if !b.partial && y_trade < b.give_rem {
                    j += 1;
                    continue;
                }

                // 実行: x を a → b、y を b → a
                let (a_hid, b_hid) = (a.hid, b.hid);
                let (xi, yi) = (a.give, b.give);
                {
                    let ha = self.humans.get_mut(&a_hid).unwrap();
                    *ha.inventory.get_mut(&xi).unwrap() -= x_trade;
                    ha.inventory.retain(|_, v| *v > 0);
                    *ha.inventory.entry(yi).or_insert(0) += y_trade;
                }
                {
                    let hb = self.humans.get_mut(&b_hid).unwrap();
                    *hb.inventory.get_mut(&yi).unwrap() -= y_trade;
                    hb.inventory.retain(|_, v| *v > 0);
                    *hb.inventory.entry(xi).or_insert(0) += x_trade;
                }
                let (x_pub, y_pub) = (self.laws.id_of_index[xi], self.laws.id_of_index[yi]);
                self.push_event(
                    a_hid,
                    Event::TradeExecuted {
                        counterparty: b_hid,
                        gave: (x_pub, x_trade),
                        got: (y_pub, y_trade),
                    },
                );
                self.push_event(
                    b_hid,
                    Event::TradeExecuted {
                        counterparty: a_hid,
                        gave: (y_pub, y_trade),
                        got: (x_pub, x_trade),
                    },
                );
                // 板は記名: 約定で互いを知り、親密度が上がる
                self.add_acquaintance(a_hid, b_hid);
                self.bump_intimacy(a_hid, b_hid);
                *self.trade_volume.entry(xi).or_insert(0) += 1;
                *self.trade_volume.entry(yi).or_insert(0) += 1;

                xy[i].give_rem -= x_trade;
                yx[j].give_rem -= y_trade;
                if xy[i].give_rem == 0 {
                    i += 1;
                }
                if yx[j].give_rem == 0 {
                    j += 1;
                }
            }
        }
    }
}
