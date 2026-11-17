# Settimana 1: misure da fare sui Mac

Due misure decidono le scelte delle settimane successive. Vanno fatte sui Mac veri (8 GB).

## 1. Benchmark di trascrizione

Su 3 girati reali (intervista pulita, audio rumoroso o più voci, uno di almeno 10 minuti):

```
/silo:benchmark ~/Girati/intervista1.mov ~/Girati/evento.mp4 ~/Girati/podcast.wav
```

oppure da terminale:

```sh
sh ~/.claude/plugins/cache/silo-marketplace/silo/*/scripts/bench-transcribe.sh --lang it file...
```

Da annotare per ogni Mac: modello, RTF, picco di RAM, confidenza media, errori su nomi propri.
Obiettivo: RTF sotto 0,2 con large-v3-turbo q5_0 (1 ora di girato in meno di 12 minuti) senza
andare in swap con Claude Code e il browser aperti.

| Mac | RAM | File | Modello | RTF | RAM picco | Confidenza | Note |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## 2. Consumo del piano Pro

Da fare appena c'è `/silo:bozza` (settimana 3); per ora si può simulare chiedendo a Claude di
leggere un trascritto da 20 minuti e proporre i tagli.

1. In Claude Code, `/usage` (o Impostazioni → Utilizzo) e annota la percentuale della finestra corrente.
2. Esegui una bozza tipo su un'intervista da 20 minuti, con il modello che useremo (Opus).
3. Rileggi `/usage` e annota la differenza, il numero di tool call e la durata.
4. Ripeti con un modello più leggero per i comandi meccanici (`/sottotitoli`, `/export`).

| Data | Video | Modello | % finestra usata | Tool call | Note |
|---|---|---|---|---|---|
| | | | | | |

Se una bozza consuma più di un terzo della finestra, rivediamo prima della settimana 3 quanta
parte della pulizia spostare nel motore.
