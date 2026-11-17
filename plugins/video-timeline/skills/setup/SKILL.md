---
name: setup
description: Installa o controlla ciò che serve a video-timeline su questo Mac (ffmpeg, whisper-cpp, modello Whisper, motore). Usala al primo utilizzo, quando un tool video-timeline dice che manca qualcosa, o quando l'utente chiede di installare o aggiornare video-timeline.
---

# Setup di video-timeline

1. Chiama il tool MCP `setup_check`. Se `ok` è true, dillo in una riga e fermati.
2. Altrimenti spiega in breve cosa manca, poi lancia:
   ```
   sh "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh"
   ```
   Lo script è idempotente: installa con Homebrew solo ciò che manca e scarica il modello
   `large-v3-turbo q5_0` (~0,5 GB) in `${CLAUDE_PLUGIN_DATA}/models`. Sui Mac da 8 GB scarica
   anche `medium q5_0` come ripiego. Può richiedere alcuni minuti: avvisa l'utente.
3. Se Homebrew manca, lo script si ferma: chiedi all'utente di installarlo da https://brew.sh
   (richiede la sua password, non puoi farlo tu) e poi rilancia.
4. Se il server MCP `video-timeline` non era connesso, alla fine chiedi all'utente di riavviare Claude Code.
5. Richiama `setup_check` e riporta il risultato.

Per un controllo senza installare nulla: `sh "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" --check`.
