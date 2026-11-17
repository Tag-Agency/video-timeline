---
name: progetto
description: Crea o apre un progetto video silo in una cartella e importa i girati. Usala quando l'utente vuole iniziare a montare dei file, aprire un progetto esistente o vedere cosa contiene.
argument-hint: "[cartella o file video]"
---

# Progetto silo

Richiesta: $ARGUMENTS

- Un progetto è una cartella sul disco del Mac con `progetto.silo.json`, `cache/` ed `export/`.
  I girati originali non vengono mai copiati né modificati: il progetto li riferisce.
- Se l'utente indica una cartella che contiene già `progetto.silo.json`, usa `project_open`.
- Se indica dei file video, proponi una cartella progetto (default: accanto ai file, con un nome
  leggibile) e usa `project_create` con `media`. Non chiedere conferma per il nome: si può cambiare.
- Per aggiungere file a un progetto aperto usa `project_import`. Per un singolo file senza progetto
  basta `media_probe`.
- Riporta il riassunto restituito dal tool in poche righe. Se segnala file a frame rate variabile
  (VFR, tipico degli smartphone), avvisa che andranno conformati prima del render.
- Se un tool risponde che ffprobe manca, usa la skill `setup`.
