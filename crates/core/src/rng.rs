//! 決定論的ハッシュ乱数。プラットフォーム非依存の整数演算のみ。
//! 乱数は必ず「シード × 文脈（human-id, tick, 用途タグ）」のハッシュとして引く。
//! 状態を持つ RNG を回し順に依存させると、処理順の変更が歴史を変えてしまう。

/// splitmix64。単体でも均質な 64bit ハッシュとして十分。
pub fn splitmix64(mut x: u64) -> u64 {
    x = x.wrapping_add(0x9E3779B97F4A7C15);
    let mut z = x;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
    z ^ (z >> 31)
}

pub fn hash2(a: u64, b: u64) -> u64 {
    splitmix64(splitmix64(a) ^ b)
}

pub fn hash3(a: u64, b: u64, c: u64) -> u64 {
    splitmix64(hash2(a, b) ^ c)
}

pub fn hash4(a: u64, b: u64, c: u64, d: u64) -> u64 {
    splitmix64(hash3(a, b, c) ^ d)
}

/// 決定論的確率丸め: exact_num / den の端数を hash で切り上げ/切り捨てする。
/// docs/design/08-architecture.md「floor 一律だと少量在庫が永遠に腐らない」対策。
pub fn div_round_stochastic(exact_num: u128, den: u64, h: u64) -> u64 {
    let q = (exact_num / den as u128) as u64;
    let r = (exact_num % den as u128) as u64;
    if r == 0 {
        q
    } else if (h % den) < r {
        q + 1
    } else {
        q
    }
}

/// FNV-1a 64bit。世界状態のハッシュ（決定論テスト・リプレイ検証用）。
pub struct Fnv1a(pub u64);

impl Fnv1a {
    pub fn new() -> Self {
        Fnv1a(0xcbf29ce484222325)
    }
    pub fn write_u8(&mut self, b: u8) {
        self.0 ^= b as u64;
        self.0 = self.0.wrapping_mul(0x100000001b3);
    }
    pub fn write_u64(&mut self, v: u64) {
        for b in v.to_le_bytes() {
            self.write_u8(b);
        }
    }
    pub fn write_u32(&mut self, v: u32) {
        for b in v.to_le_bytes() {
            self.write_u8(b);
        }
    }
    pub fn write_bytes(&mut self, bs: &[u8]) {
        for &b in bs {
            self.write_u8(b);
        }
    }
    pub fn finish(&self) -> u64 {
        self.0
    }
}

impl Default for Fnv1a {
    fn default() -> Self {
        Self::new()
    }
}
