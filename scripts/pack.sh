#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

version=$(node -p "require('./manifest.json').version")
mkdir -p dist
out="dist/custo-real-$version.zip"

rm -f "$out"
# só o que a extensão precisa em runtime, sem testes nem documentação
zip -rq "$out" manifest.json src icons -x "*.DS_Store"

echo "criado $out"
unzip -l "$out"
