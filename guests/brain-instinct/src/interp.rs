//! Instinct v1（`#!instinct/1`）のパーサと評価器。
//!
//! ライトユーザ向けの brain 専用ルール言語。文法:
//!
//! ```text
//! #!instinct/1
//! # コメント（行末まで）
//! var <名前>                     # 月をまたぐ i64 カウンタ（初期値 0）
//! when <式> do <動作>[, <動作>]*  # 毎月、上から順に評価
//! ```
//!
//! 式は i64。識別子: health(0-100) / food(学習済み食料の保有単位) /
//! month / age(年) / acq(生存知人数) / knows_food(0/1) / rand(0..999) /
//! 宣言済み var。演算: + - * / % 比較 && || ! ()（非 0 が真）。
//! 動作: harvest / eat / explore / discard / give_food / mingle / set <var> = <式>。
//! 適用不能な動作（食料未学習の eat など）は枠を消費せずスキップする。
//!
//! このモジュールは wit-bindgen に依存しない純粋ロジック（ネイティブでテスト可能）。

#[derive(Debug, Clone, PartialEq)]
pub enum Action {
    Harvest,
    Eat,
    Explore,
    Discard,
    GiveFood,
    Mingle,
    Set(usize, Expr), // var index, 右辺
}

#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    Num(i64),
    /// 組み込み識別子（環境から値を引く）
    Builtin(Builtin),
    Var(usize),
    Unary(UnOp, Box<Expr>),
    Binary(BinOp, Box<Expr>, Box<Expr>),
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Builtin {
    Health,
    Food,
    Month,
    Age,
    Acq,
    KnowsFood,
    Rand,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum UnOp {
    Not,
    Neg,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BinOp {
    Add,
    Sub,
    Mul,
    Div,
    Rem,
    Lt,
    Le,
    Gt,
    Ge,
    Eq,
    Ne,
    And,
    Or,
}

#[derive(Debug, Clone)]
pub struct Rule {
    pub cond: Expr,
    pub actions: Vec<Action>,
}

#[derive(Debug, Clone)]
pub struct Program {
    pub var_names: Vec<String>,
    pub rules: Vec<Rule>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ParseError {
    pub line: u32,
    pub message: String,
}

fn err(line: u32, message: &str) -> ParseError {
    ParseError {
        line,
        message: message.to_string(),
    }
}

/// スクリプト全体をパースする。1 行目は `#!instinct/1` 固定
pub fn parse(src: &str) -> Result<Program, ParseError> {
    let mut lines = src.lines().enumerate();
    let header = loop {
        match lines.next() {
            Some((i, l)) => {
                let t = l.trim();
                if t.is_empty() {
                    continue;
                }
                break (i as u32 + 1, t);
            }
            None => {
                return Err(err(
                    1,
                    "空のスクリプトです。1 行目に #!instinct/1 が必要です",
                ))
            }
        }
    };
    if header.1 != "#!instinct/1" {
        return Err(err(
            header.0,
            "1 行目は #!instinct/1 である必要があります（言語とバージョンの宣言）",
        ));
    }

    let mut prog = Program {
        var_names: Vec::new(),
        rules: Vec::new(),
    };
    for (i, raw) in lines {
        let line_no = i as u32 + 1;
        let line = match raw.find('#') {
            Some(p) => &raw[..p],
            None => raw,
        };
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(rest) = line.strip_prefix("var ") {
            let name = rest.trim();
            if !is_ident(name) {
                return Err(err(line_no, "var の名前が不正です（英数字と _ のみ）"));
            }
            if builtin_of(name).is_some() {
                return Err(err(line_no, "組み込み名と同じ var は宣言できません"));
            }
            if prog.var_names.iter().any(|n| n == name) {
                return Err(err(line_no, "同名の var が二重に宣言されています"));
            }
            prog.var_names.push(name.to_string());
            continue;
        }
        if let Some(rest) = line.strip_prefix("when ") {
            let Some(pos) = find_do(rest) else {
                return Err(err(
                    line_no,
                    "when には do が必要です（when <条件> do <動作>）",
                ));
            };
            let (cond_src, act_src) = (&rest[..pos], &rest[pos + 4..]);
            let cond = parse_expr_str(cond_src, &prog.var_names, line_no)?;
            let mut actions = Vec::new();
            for part in act_src.split(',') {
                actions.push(parse_action(part.trim(), &prog.var_names, line_no)?);
            }
            if actions.is_empty() {
                return Err(err(line_no, "do の後に動作がありません"));
            }
            prog.rules.push(Rule { cond, actions });
            continue;
        }
        return Err(err(
            line_no,
            "解釈できない行です（var <名前> か when <条件> do <動作> の形）",
        ));
    }
    Ok(prog)
}

/// 式の途中の識別子を拾わないよう、空白で囲まれた " do " を探す。
/// 返り値は先頭の空白の位置（cond は [..pos]、動作列は [pos + 4..]）
fn find_do(s: &str) -> Option<usize> {
    s.find(" do ")
}

fn is_ident(s: &str) -> bool {
    !s.is_empty()
        && s.chars().next().unwrap().is_ascii_alphabetic()
        && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

fn builtin_of(name: &str) -> Option<Builtin> {
    Some(match name {
        "health" => Builtin::Health,
        "food" => Builtin::Food,
        "month" => Builtin::Month,
        "age" => Builtin::Age,
        "acq" => Builtin::Acq,
        "knows_food" => Builtin::KnowsFood,
        "rand" => Builtin::Rand,
        _ => return None,
    })
}

fn parse_action(s: &str, vars: &[String], line: u32) -> Result<Action, ParseError> {
    match s {
        "harvest" => return Ok(Action::Harvest),
        "eat" => return Ok(Action::Eat),
        "explore" => return Ok(Action::Explore),
        "discard" => return Ok(Action::Discard),
        "give_food" => return Ok(Action::GiveFood),
        "mingle" => return Ok(Action::Mingle),
        _ => {}
    }
    if let Some(rest) = s.strip_prefix("set ") {
        let Some(eq) = rest.find('=') else {
            return Err(err(line, "set は set <var> = <式> の形です"));
        };
        let name = rest[..eq].trim();
        let Some(idx) = vars.iter().position(|n| n == name) else {
            return Err(err(line, "set の対象は宣言済みの var だけです"));
        };
        let expr = parse_expr_str(rest[eq + 1..].trim(), vars, line)?;
        return Ok(Action::Set(idx, expr));
    }
    Err(err(
        line,
        "未知の動作です（harvest / eat / explore / discard / give_food / mingle / set）",
    ))
}

// --- 式パーサ（再帰下降・優先順位法） -----------------------------------------

struct Lexer<'a> {
    toks: Vec<Tok<'a>>,
    pos: usize,
    line: u32,
    vars: &'a [String],
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Tok<'a> {
    Num(i64),
    Ident(&'a str),
    Op(&'a str),
    LParen,
    RParen,
}

fn lex<'a>(src: &'a str, line: u32) -> Result<Vec<Tok<'a>>, ParseError> {
    let mut out = Vec::new();
    let b = src.as_bytes();
    let mut i = 0;
    while i < b.len() {
        let c = b[i] as char;
        if c.is_ascii_whitespace() {
            i += 1;
            continue;
        }
        if c.is_ascii_digit() {
            let start = i;
            while i < b.len() && (b[i] as char).is_ascii_digit() {
                i += 1;
            }
            let n: i64 = src[start..i]
                .parse()
                .map_err(|_| err(line, "数値が大きすぎます"))?;
            out.push(Tok::Num(n));
            continue;
        }
        if c.is_ascii_alphabetic() || c == '_' {
            let start = i;
            while i < b.len() && ((b[i] as char).is_ascii_alphanumeric() || b[i] == b'_') {
                i += 1;
            }
            out.push(Tok::Ident(&src[start..i]));
            continue;
        }
        if c == '(' {
            out.push(Tok::LParen);
            i += 1;
            continue;
        }
        if c == ')' {
            out.push(Tok::RParen);
            i += 1;
            continue;
        }
        // 2 文字演算子を 1 文字より先に
        let two = if i + 2 <= b.len() { &src[i..i + 2] } else { "" };
        if ["&&", "||", "<=", ">=", "==", "!="].contains(&two) {
            out.push(Tok::Op(two));
            i += 2;
            continue;
        }
        let one = &src[i..i + 1];
        if ["+", "-", "*", "/", "%", "<", ">", "!"].contains(&one) {
            out.push(Tok::Op(one));
            i += 1;
            continue;
        }
        return Err(err(line, "式に使えない文字があります"));
    }
    Ok(out)
}

fn parse_expr_str(src: &str, vars: &[String], line: u32) -> Result<Expr, ParseError> {
    let toks = lex(src, line)?;
    if toks.is_empty() {
        return Err(err(line, "式が空です"));
    }
    let mut p = Lexer {
        toks,
        pos: 0,
        line,
        vars,
    };
    let e = parse_or(&mut p)?;
    if p.pos != p.toks.len() {
        return Err(err(line, "式の途中に解釈できないトークンがあります"));
    }
    Ok(e)
}

fn parse_or(p: &mut Lexer) -> Result<Expr, ParseError> {
    let mut lhs = parse_and(p)?;
    while p.eat_op("||") {
        let rhs = parse_and(p)?;
        lhs = Expr::Binary(BinOp::Or, lhs.into(), rhs.into());
    }
    Ok(lhs)
}

fn parse_and(p: &mut Lexer) -> Result<Expr, ParseError> {
    let mut lhs = parse_cmp(p)?;
    while p.eat_op("&&") {
        let rhs = parse_cmp(p)?;
        lhs = Expr::Binary(BinOp::And, lhs.into(), rhs.into());
    }
    Ok(lhs)
}

fn parse_cmp(p: &mut Lexer) -> Result<Expr, ParseError> {
    let lhs = parse_add(p)?;
    for (op, b) in [
        ("<=", BinOp::Le),
        (">=", BinOp::Ge),
        ("==", BinOp::Eq),
        ("!=", BinOp::Ne),
        ("<", BinOp::Lt),
        (">", BinOp::Gt),
    ] {
        if p.eat_op(op) {
            let rhs = parse_add(p)?;
            return Ok(Expr::Binary(b, lhs.into(), rhs.into()));
        }
    }
    Ok(lhs)
}

fn parse_add(p: &mut Lexer) -> Result<Expr, ParseError> {
    let mut lhs = parse_mul(p)?;
    loop {
        if p.eat_op("+") {
            let rhs = parse_mul(p)?;
            lhs = Expr::Binary(BinOp::Add, lhs.into(), rhs.into());
        } else if p.eat_op("-") {
            let rhs = parse_mul(p)?;
            lhs = Expr::Binary(BinOp::Sub, lhs.into(), rhs.into());
        } else {
            return Ok(lhs);
        }
    }
}

fn parse_mul(p: &mut Lexer) -> Result<Expr, ParseError> {
    let mut lhs = parse_unary(p)?;
    loop {
        if p.eat_op("*") {
            let rhs = parse_unary(p)?;
            lhs = Expr::Binary(BinOp::Mul, lhs.into(), rhs.into());
        } else if p.eat_op("/") {
            let rhs = parse_unary(p)?;
            lhs = Expr::Binary(BinOp::Div, lhs.into(), rhs.into());
        } else if p.eat_op("%") {
            let rhs = parse_unary(p)?;
            lhs = Expr::Binary(BinOp::Rem, lhs.into(), rhs.into());
        } else {
            return Ok(lhs);
        }
    }
}

fn parse_unary(p: &mut Lexer) -> Result<Expr, ParseError> {
    if p.eat_op("!") {
        return Ok(Expr::Unary(UnOp::Not, parse_unary(p)?.into()));
    }
    if p.eat_op("-") {
        return Ok(Expr::Unary(UnOp::Neg, parse_unary(p)?.into()));
    }
    parse_atom(p)
}

fn parse_atom(p: &mut Lexer) -> Result<Expr, ParseError> {
    let line = p.line;
    match p.next() {
        Some(Tok::Num(n)) => Ok(Expr::Num(n)),
        Some(Tok::Ident(name)) => {
            if let Some(b) = builtin_of(name) {
                Ok(Expr::Builtin(b))
            } else if let Some(idx) = p.vars.iter().position(|v| v == name) {
                Ok(Expr::Var(idx))
            } else {
                Err(err(line, "未知の識別子です（組み込みか宣言済み var のみ）"))
            }
        }
        Some(Tok::LParen) => {
            let e = parse_or(p)?;
            if p.next() != Some(Tok::RParen) {
                return Err(err(line, "閉じ括弧 ) がありません"));
            }
            Ok(e)
        }
        _ => Err(err(line, "式の形が不正です")),
    }
}

impl<'a> Lexer<'a> {
    fn next(&mut self) -> Option<Tok<'a>> {
        let t = self.toks.get(self.pos).copied();
        if t.is_some() {
            self.pos += 1;
        }
        t
    }
    fn eat_op(&mut self, op: &str) -> bool {
        if self.toks.get(self.pos) == Some(&Tok::Op(&op[..])) {
            self.pos += 1;
            true
        } else {
            false
        }
    }
}

// --- 評価 ---------------------------------------------------------------------

/// 評価環境（組み込み識別子の値）
pub struct Env {
    pub health: i64,
    pub food: i64,
    pub month: i64,
    pub age: i64,
    pub acq: i64,
    pub knows_food: bool,
    pub rand: i64,
}

pub fn eval(e: &Expr, env: &Env, vars: &[i64]) -> i64 {
    match e {
        Expr::Num(n) => *n,
        Expr::Builtin(b) => match b {
            Builtin::Health => env.health,
            Builtin::Food => env.food,
            Builtin::Month => env.month,
            Builtin::Age => env.age,
            Builtin::Acq => env.acq,
            Builtin::KnowsFood => env.knows_food as i64,
            Builtin::Rand => env.rand,
        },
        Expr::Var(i) => vars.get(*i).copied().unwrap_or(0),
        Expr::Unary(op, a) => {
            let v = eval(a, env, vars);
            match op {
                UnOp::Not => (v == 0) as i64,
                UnOp::Neg => v.wrapping_neg(),
            }
        }
        Expr::Binary(op, a, b) => {
            let x = eval(a, env, vars);
            // && || は短絡
            match op {
                BinOp::And => return ((x != 0) && (eval(b, env, vars) != 0)) as i64,
                BinOp::Or => return ((x != 0) || (eval(b, env, vars) != 0)) as i64,
                _ => {}
            }
            let y = eval(b, env, vars);
            match op {
                BinOp::Add => x.wrapping_add(y),
                BinOp::Sub => x.wrapping_sub(y),
                BinOp::Mul => x.wrapping_mul(y),
                BinOp::Div => x.checked_div(y).unwrap_or(0),
                BinOp::Rem => x.checked_rem(y).unwrap_or(0),
                BinOp::Lt => (x < y) as i64,
                BinOp::Le => (x <= y) as i64,
                BinOp::Gt => (x > y) as i64,
                BinOp::Ge => (x >= y) as i64,
                BinOp::Eq => (x == y) as i64,
                BinOp::Ne => (x != y) as i64,
                BinOp::And | BinOp::Or => unreachable!(),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn env() -> Env {
        Env {
            health: 80,
            food: 5,
            month: 13,
            age: 20,
            acq: 3,
            knows_food: true,
            rand: 7,
        }
    }

    #[test]
    fn parses_and_evals() {
        let p = parse(
            "#!instinct/1\n# c\nvar tries\nwhen health < 90 && food > 0 do eat\nwhen month % 2 == 1 do discard, set tries = tries + 1\n",
        )
        .unwrap();
        assert_eq!(p.var_names, ["tries"]);
        assert_eq!(p.rules.len(), 2);
        assert_eq!(eval(&p.rules[0].cond, &env(), &[0]), 1);
        assert_eq!(eval(&p.rules[1].cond, &env(), &[0]), 1);
    }

    #[test]
    fn rejects_bad_header_and_ident() {
        assert!(parse("when 1 do eat\n").is_err());
        let e = parse("#!instinct/1\nwhen foo > 0 do eat\n").unwrap_err();
        assert_eq!(e.line, 2);
        assert!(parse("#!instinct/1\nvar health\n").is_err());
    }

    #[test]
    fn precedence_and_paren() {
        let p = parse("#!instinct/1\nwhen 1 + 2 * 3 == 7 && (4 - 2) == 2 do eat\n").unwrap();
        assert_eq!(eval(&p.rules[0].cond, &env(), &[]), 1);
    }
}
