#!/bin/sh
# Benchmark di trascrizione whisper.cpp sui girati reali (settimana 1 dell'MVP).
#   sh bench-transcribe.sh [--lang it] [--models large,medium] [--out cartella] file1.mov file2.mp4 ...
# Per ogni file e modello misura: tempo, fattore tempo reale (RTF), picco di RAM,
# parole trascritte, confidenza media. Scrive risultati.csv e i trascritti per il controllo a occhio.
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.silo}"
MODELS_DIR="$DATA/models"
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export PATH

LANG_CODE="it"
MODELS="large,medium"
OUT="$HOME/silo-benchmark-$(date +%Y%m%d-%H%M)"
WHISPER="${SILO_WHISPER:-whisper-cli}"

while [ $# -gt 0 ]; do
  case "$1" in
    --lang) LANG_CODE="$2"; shift 2 ;;
    --models) MODELS="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    -h|--help) sed -n '2,5p' "$0"; exit 0 ;;
    --) shift; break ;;
    -*) echo "Opzione sconosciuta: $1" >&2; exit 2 ;;
    *) break ;;
  esac
done
[ $# -gt 0 ] || { echo "Indica almeno un file video o audio." >&2; exit 2; }
command -v ffmpeg >/dev/null || { echo "ffmpeg mancante: lancia setup.sh" >&2; exit 1; }
command -v "$WHISPER" >/dev/null || { echo "whisper-cli mancante: lancia setup.sh" >&2; exit 1; }

model_file() {
  case "$1" in
    large) echo "$MODELS_DIR/ggml-large-v3-turbo-q5_0.bin" ;;
    medium) echo "$MODELS_DIR/ggml-medium-q5_0.bin" ;;
    *) echo "$1" ;;  # percorso esplicito a un modello ggml
  esac
}

# Thread: i core performance su Apple Silicon, altrimenti tutti i core.
THREADS=$(sysctl -n hw.perflevel0.physicalcpu 2>/dev/null || nproc 2>/dev/null || echo 4)

# Misura del picco di RAM: /usr/bin/time -l su macOS (byte), -v su Linux (KB).
if [ "$(uname -s)" = "Darwin" ]; then TIME_FLAG="-l"; else TIME_FLAG="-v"; fi
TIMECMD=""
[ -x /usr/bin/time ] && TIMECMD="/usr/bin/time $TIME_FLAG"
peak_mb() {
  awk '/maximum resident set size/ { v=$1 } /Maximum resident set size/ { v=$NF*1024 } END { if (v) printf "%d", v/1048576; else printf "n/d" }' "$1"
}

mkdir -p "$OUT"
CSV="$OUT/risultati.csv"
echo "file,durata_s,modello,tempo_s,rtf,ram_picco_mb,parole,confidenza_media" > "$CSV"
MACHINE="$(sysctl -n machdep.cpu.brand_string 2>/dev/null || uname -m), $(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1073741824 )) GB"
echo "Benchmark su $MACHINE, $THREADS thread, lingua $LANG_CODE → $OUT"

for f in "$@"; do
  [ -f "$f" ] || { echo "  salto $f: non esiste"; continue; }
  base="$(basename "$f")"; stem="${base%.*}"
  wav="$OUT/$stem.16k.wav"
  ffmpeg -v error -y -i "$f" -vn -ac 1 -ar 16000 -c:a pcm_s16le "$wav"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$wav")
  echo "$base (${dur%.*} s)"

  for m in $(echo "$MODELS" | tr ',' ' '); do
    mf="$(model_file "$m")"
    [ -f "$mf" ] || { echo "  $m: modello non trovato ($mf), salto"; continue; }
    prefix="$OUT/$stem.$m"
    start=$(date +%s)
    # -ojf: JSON completo con timestamp e probabilità per token, base dei tagli word-level.
    # shellcheck disable=SC2086
    if ! $TIMECMD "$WHISPER" -m "$mf" -f "$wav" -l "$LANG_CODE" -t "$THREADS" \
         -ojf -otxt -of "$prefix" -np > "$prefix.log" 2> "$prefix.time"; then
      echo "  $m: whisper fallito, vedi $prefix.time"; continue
    fi
    end=$(date +%s)
    secs=$((end - start))
    rtf=$(awk -v s="$secs" -v d="$dur" 'BEGIN { printf "%.3f", (d > 0 ? s / d : 0) }')
    ram=$(peak_mb "$prefix.time")
    words=$(wc -w < "$prefix.txt" | tr -d ' ')
    conf=$(grep -o '"p": *[0-9.]*' "$prefix.json" | awk -F: '{ s += $2; n++ } END { printf "%.3f", (n ? s / n : 0) }')
    echo "  $m: ${secs}s (RTF $rtf), RAM picco ${ram} MB, $words parole, confidenza $conf"
    echo "$base,$dur,$m,$secs,$rtf,$ram,$words,$conf" >> "$CSV"
  done
  rm -f "$wav"
done

echo
echo "Risultati: $CSV"
echo "Trascritti (.txt) e JSON con timestamp nella stessa cartella: controlla a campione nomi propri e termini tecnici."
