---
name: benchmark
description: Misura velocità, RAM e qualità della trascrizione Whisper su girati reali di questo Mac, confrontando i modelli large-v3-turbo e medium. Usala quando l'utente chiede un benchmark o un test di trascrizione.
disable-model-invocation: true
argument-hint: "<file video o audio...>"
---

# Benchmark di trascrizione

File indicati dall'utente: $ARGUMENTS

1. Se non ci sono file, chiedi 2-3 girati reali rappresentativi (un'intervista pulita, una con
   rumore o più voci, una lunga almeno 10 minuti).
2. Chiama `setup_check`; se mancano whisper-cli o i modelli usa prima la skill `setup`.
   Per confrontare i due modelli serve anche il medium: `sh "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh" --with-medium`.
3. Chiudi app pesanti se l'utente è d'accordo, poi lancia (in background se i file sono lunghi):
   ```
   sh "${CLAUDE_PLUGIN_ROOT}/scripts/bench-transcribe.sh" --lang it file1 file2 ...
   ```
4. Leggi `risultati.csv` nella cartella indicata alla fine e riassumi per ogni modello: RTF
   (sotto 0,2 = 1 ora in meno di 12 minuti), picco di RAM, confidenza media.
5. Apri un paio di trascritti `.txt` e segnala errori evidenti su nomi propri e termini tecnici.
6. Concludi con una raccomandazione: modello predefinito per questo Mac e se il medium serve.
   Non incollare i trascritti interi nella conversazione.
