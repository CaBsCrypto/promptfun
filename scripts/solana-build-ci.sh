#!/usr/bin/env bash
set -euo pipefail
PF_REPO="$(cd "$(dirname "$0")/.." && pwd)"
PF_BUILD="$(mktemp -d -t promptfun-build.XXXXXX)"
PF_OUT="${SOLANA_BUILD_OUTPUT:-$PF_REPO/.local/solana-artifacts}"
trap 'rm -rf "$PF_BUILD"' EXIT
anchor --version | grep -F '1.2.1'
rustup toolchain install 1.94.0 --profile minimal
mkdir -p "$PF_BUILD/programs/promptfun-market" "$PF_BUILD/programs/market-tests" "$PF_OUT"
# Anchor's IDL builder 0.1.4 interpolates RUSTUP_TOOLCHAIN incorrectly. Select the
# pinned host compiler through the normal directory toolchain file instead.
unset RUSTUP_TOOLCHAIN
cat > "$PF_BUILD/rust-toolchain.toml" <<'PF_TOOLCHAIN'
[toolchain]
channel = "1.94.0"
profile = "minimal"
PF_TOOLCHAIN
cp "$PF_REPO/Cargo.toml" "$PF_REPO/Cargo.lock" "$PF_REPO/Anchor.toml" "$PF_BUILD/"
cp "$PF_REPO/programs/promptfun-market/Cargo.toml" "$PF_BUILD/programs/promptfun-market/"
cp -R "$PF_REPO/programs/promptfun-market/src" "$PF_BUILD/programs/promptfun-market/"
cp "$PF_REPO/programs/market-tests/Cargo.toml" "$PF_REPO/programs/market-tests/Cargo.lock" "$PF_BUILD/programs/market-tests/"
cp -R "$PF_REPO/programs/market-tests/src" "$PF_BUILD/programs/market-tests/"
cd "$PF_BUILD"
cargo test -p promptfun-market --lib --locked
# The SBF builder and IDL builder accept different argument separators. Never
# forward SBF's Cargo separator into the IDL cargo-test harness.
anchor build --no-idl --ignore-keys --tools-version v1.57 --arch v3 -- -- --locked
mkdir -p target/idl
anchor idl build --out target/idl/promptfun_market.json -- --locked
cargo test --manifest-path programs/market-tests/Cargo.toml --locked
cp target/deploy/promptfun_market.so "$PF_OUT/promptfun_market.so"
cp target/idl/promptfun_market.json "$PF_OUT/promptfun_market.json"
# Only public artifacts and build evidence leave the temporary directory.
cargo run --manifest-path programs/market-tests/Cargo.toml --locked --bin artifact -- "$PF_OUT" "$PF_BUILD"
