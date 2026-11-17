# silo

Editor video guidato da Claude, come plugin di Claude Code. Claude fa da regista tramite un
server MCP locale; trascrizione (whisper.cpp), analisi e render (FFmpeg) girano sul Mac.
Ognuno usa il proprio abbonamento Claude: nessuna chiave API.

Design e piano MVP: https://claude.ai/artifact/2fQyYRBh5JPDBHnVJiCX5L

## Installazione su un Mac (una volta)

Prerequisiti: Mac Apple Silicon, Claude Code con il proprio account, [Homebrew](https://brew.sh),
accesso a questo repository.

```sh
gh auth login          # se non l'hai mai fatto
gh auth setup-git      # Claude Code usa le credenziali git per i repo privati
```

In Claude Code:

```
/plugin marketplace add Tag-Agency/video-timeline
/plugin install silo@silo-marketplace
```

Poi chiedi a Claude "esegui il setup di silo" (o `/silo:setup`): installa ffmpeg e whisper-cpp se
mancano e scarica il modello Whisper large-v3-turbo q5_0 (~0,5 GB) nella cartella dati del plugin.
Riavvia Claude Code se il server `silo` risultava non connesso.

Aggiornamenti: `/plugin marketplace update silo-marketplace`, oppure attiva l'auto-update in `/plugin`.

## Cosa fa oggi (settimana 1)

| Tool MCP | Uso |
|---|---|
| `project_create` | Crea una cartella progetto (`progetto.silo.json`, `cache/`, `export/`) e importa i girati |
| `project_open` / `project_info` | Apre un progetto e ne dà un riassunto compatto |
| `project_import` | Aggiunge girati al progetto aperto (riferiti, mai copiati) |
| `media_probe` | Durata, fps esatto (frazione), risoluzione, rotazione, tracce audio, VFR |
| `setup_check` | Controlla ffmpeg, whisper-cli e modelli su questo Mac |

Skill: `/silo:setup`, `/silo:progetto`, `/silo:benchmark`.

## Struttura

```
.claude-plugin/marketplace.json   marketplace (questo repo)
plugins/silo/                     il plugin installato sui Mac
  .claude-plugin/plugin.json
  .mcp.json                       avvia server/silo-engine
  server/                         launcher + bundle engine.mjs (generato) + VERSION
  scripts/setup.sh                installazione idempotente
  scripts/bench-transcribe.sh     benchmark di trascrizione
  skills/                         skill e slash command
engine/                           sorgente TypeScript del motore (non distribuito)
docs/                             note di sviluppo e benchmark
```

## Sviluppo

```sh
cd engine
npm ci
npm test            # bun test: unità + end-to-end MCP (serve ffmpeg)
npm run typecheck
npm run build       # rigenera plugins/silo/server/engine.mjs (da committare)
```

Il motore parte con l'eseguibile compilato in `${CLAUDE_PLUGIN_DATA}/engine/` se c'è, altrimenti
con `node` o `bun`. Per pubblicare una versione: aggiorna la versione in `plugin.json`,
`marketplace.json`, `server/VERSION` ed `engine/package.json`, poi crea il tag `vX.Y.Z`: la CI
compila `silo-engine-darwin-arm64` e lo allega alla release, da cui `setup.sh` lo scarica.

Per provare il plugin in locale senza installarlo: `claude --plugin-dir plugins/silo`.
