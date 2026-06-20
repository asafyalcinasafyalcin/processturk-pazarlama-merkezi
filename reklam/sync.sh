#!/usr/bin/env bash
# Reklam alt-ajan tanımlarını kaynak klasörden .claude/agents/'a kopyalar (satınalma deseni).
# Kaynak tek doğru: Processturk_Pazarlama_Merkezi/reklam/claude-subagents/reklam-*.md
# Hedef: workspace kökündeki .claude/agents (reklam/ iki seviye derinde → ../../).
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)/claude-subagents"
DEST="$(cd "$(dirname "$0")/../.." && pwd)/.claude/agents"
mkdir -p "$DEST"
for f in "$SRC"/reklam-*.md; do
  cp "$f" "$DEST/$(basename "$f")"
  echo "  senkron: $(basename "$f")"
done
echo "Reklam alt-ajanları .claude/agents/'a kopyalandı."
