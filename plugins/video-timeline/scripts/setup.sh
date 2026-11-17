#!/bin/sh
# Setup di video-timeline su un Mac Apple Silicon. Idempotente: si può rilanciare quando serve.
#   sh setup.sh                 installa ffmpeg, whisper-cpp, modello large-v3-turbo q5_0, motore
#   sh setup.sh --with-medium   scarica anche il modello medium (ripiego per Mac con poca RAM)
#   sh setup.sh --check         controlla soltanto, senza installare nulla
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$SCRIPT_DIR")}"
DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.video-timeline}"
MODELS="$DATA/models"
ENGINE_DIR="$DATA/engine"
VER="$(cat "$PLUGIN_ROOT/server/VERSION")"
REPO="${VT_REPO:-Tag-Agency/video-timeline}"
HF="https://huggingface.co/ggerganov/whisper.cpp/resolve/main"
MODEL_LARGE="ggml-large-v3-turbo-q5_0.bin"
MODEL_MEDIUM="ggml-medium-q5_0.bin"

WITH_MEDIUM=0
CHECK_ONLY=0
for a in "$@"; do
  case "$a" in
    --with-medium) WITH_MEDIUM=1 ;;
    --check) CHECK_ONLY=1 ;;
    *) echo "Opzione sconosciuta: $a" >&2; exit 2 ;;
  esac
done

PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export PATH
ok()   { printf '  ✓ %s\n' "$1"; }
warn() { printf '  ! %s\n' "$1"; }
fail() { printf '  ✗ %s\n' "$1" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

echo "video-timeline $VER: setup in $DATA"

# 1. Macchina
if [ "$(uname -s)" != "Darwin" ]; then warn "non è macOS: proseguo, ma video-timeline è pensato per Mac Apple Silicon"; fi
if [ "$(uname -m)" != "arm64" ]; then warn "processore non Apple Silicon: la trascrizione sarà lenta"; fi
if [ "$(uname -s)" = "Darwin" ]; then
  RAM_GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
  ok "Mac con $RAM_GB GB di RAM ($(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo Apple))"
  if [ "$RAM_GB" -le 8 ]; then WITH_MEDIUM=1; warn "8 GB di RAM: scarico anche il modello medium come ripiego"; fi
fi

# 2. Homebrew, ffmpeg, whisper-cpp
brew_install() {
  formula="$1"; bin="$2"
  if have "$bin"; then ok "$bin presente ($(command -v "$bin"))"; return; fi
  [ "$CHECK_ONLY" = 1 ] && { warn "$bin mancante"; return; }
  have brew || fail "Homebrew non trovato. Installalo da https://brew.sh e rilancia questo script."
  echo "  … installo $formula con Homebrew"
  brew install "$formula"
  have "$bin" || fail "$bin non trovato dopo brew install $formula"
  ok "$bin installato"
}
brew_install ffmpeg ffmpeg
brew_install ffmpeg ffprobe
brew_install whisper-cpp whisper-cli

# 3. Modelli Whisper (sopravvivono agli aggiornamenti del plugin)
mkdir -p "$MODELS"
download_model() {
  name="$1"; min_mb="$2"
  dest="$MODELS/$name"
  if [ -f "$dest" ]; then ok "modello $name presente ($(( $(wc -c < "$dest") / 1000000 )) MB)"; return; fi
  [ "$CHECK_ONLY" = 1 ] && { warn "modello $name mancante"; return; }
  echo "  … scarico $name (~0,5 GB, riprende se interrotto)"
  curl -fL --retry 3 -C - -o "$dest.part" "$HF/$name"
  size_mb=$(( $(wc -c < "$dest.part") / 1000000 ))
  [ "$size_mb" -ge "$min_mb" ] || fail "download di $name incompleto ($size_mb MB)"
  mv "$dest.part" "$dest"
  ok "modello $name scaricato ($size_mb MB)"
}
download_model "$MODEL_LARGE" 500
[ "$WITH_MEDIUM" = 1 ] && download_model "$MODEL_MEDIUM" 480

# 4. Motore: eseguibile compilato dalla release GitHub, altrimenti Node
BIN="$ENGINE_DIR/vt-engine-$VER"
if [ -x "$BIN" ]; then
  ok "motore $VER presente"
elif [ "$CHECK_ONLY" = 1 ]; then
  if have node || have bun; then ok "motore: userà $(have node && echo node || echo bun) con il bundle"; else warn "motore non installato"; fi
else
  mkdir -p "$ENGINE_DIR"
  if have gh && gh release download "v$VER" -R "$REPO" -p "vt-engine-darwin-arm64" -O "$BIN.part" --clobber >/dev/null 2>&1; then
    mv "$BIN.part" "$BIN"; chmod +x "$BIN"
    xattr -d com.apple.quarantine "$BIN" 2>/dev/null || true
    codesign --force -s - "$BIN" 2>/dev/null || true  # firma ad-hoc, richiesta su Apple Silicon
    ok "motore $VER scaricato dalla release"
  elif have node || have bun; then
    rm -f "$BIN.part"
    ok "nessuna release $VER: il motore userà $(have node && echo node || echo bun)"
  else
    rm -f "$BIN.part"
    have brew || fail "serve Homebrew per installare Node (https://brew.sh)"
    echo "  … nessuna release disponibile, installo Node con Homebrew"
    brew install node
    ok "Node installato: il motore userà node"
  fi
fi

echo
sh "$PLUGIN_ROOT/server/vt-engine" --version >/dev/null 2>&1 && ok "il motore si avvia" || fail "il motore non si avvia: lancia sh \"$PLUGIN_ROOT/server/vt-engine\" --version per vedere l'errore"
if [ "$CHECK_ONLY" = 1 ]; then echo "Controllo completato (nessuna installazione eseguita)."; else echo "Setup completato. Riavvia Claude Code se il server MCP video-timeline risultava non connesso."; fi
