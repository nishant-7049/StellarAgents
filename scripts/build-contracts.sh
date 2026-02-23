#!/usr/bin/env bash
set -euo pipefail
echo "=== Building Soroban Contracts ==="
cd "$(dirname "$0")/../contracts"
export PATH="$HOME/.cargo/bin:$PATH"
echo "Running cargo build..."
cargo build --release --target wasm32-unknown-unknown
echo ""
echo "WASM outputs:"
ls -la target/wasm32-unknown-unknown/release/*.wasm 2>/dev/null || echo "No WASM files found"
echo ""
echo "Build complete!"
