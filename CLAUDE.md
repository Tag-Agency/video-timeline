# silo: note per Claude

- Plugin Claude Code per montaggio video. Design: https://claude.ai/artifact/2fQyYRBh5JPDBHnVJiCX5L
- Utenti su piano Claude Pro, Mac Apple Silicon da 8 GB: i tool MCP devono restituire testo
  compatto (riassunti e id, mai dump), e tutto il lavoro meccanico va fatto nel motore.
- Testi per l'utente (skill, messaggi d'errore dei tool, README) in italiano.
- Tempi sempre come frame razionali (`engine/src/rational.ts`), mai secondi float nella timeline.
- Il motore scrive solo su stderr; stdout è del protocollo MCP.
- Dopo ogni modifica a `engine/src`: `npm test`, `npm run typecheck`, `npm run build` e committa
  `plugins/silo/server/engine.mjs` (la CI controlla che sia aggiornato).
- Niente cartella `bin/` alla radice del plugin.
