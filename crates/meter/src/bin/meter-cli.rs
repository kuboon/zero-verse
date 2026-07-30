//! fuel 計装 CLI（build-web.sh がビルトイン brain の core wasm に適用する）。
//! 使い方: meter-cli <in.wasm> <out.wasm>

fn main() -> anyhow::Result<()> {
    let mut args = std::env::args().skip(1);
    let (Some(input), Some(output)) = (args.next(), args.next()) else {
        anyhow::bail!("usage: meter-cli <in.wasm> <out.wasm>");
    };
    let bytes = std::fs::read(&input)?;
    let out = zeroverse_meter::meter(&bytes)?;
    std::fs::write(&output, &out)?;
    println!(
        "metered: {input} ({} bytes) -> {output} ({} bytes)",
        bytes.len(),
        out.len()
    );
    Ok(())
}
