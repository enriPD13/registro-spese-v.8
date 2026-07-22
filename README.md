# Registro Spese v8

App di finanza personale (PWA) per libero professionista in regime forfettario:
spese ricorrenti e una tantum, entrate e fatture, calendario, fondo tasse e obiettivi di risparmio.

Funziona offline, si installa sulla schermata Home dell'iPhone e sincronizza con Google Drive.

## Struttura del progetto

A differenza della v7, il codice non è più in un unico file: ogni parte ha il suo posto.

```
index.html                struttura della pagina (nessuna logica)
styles.css                tutto l'aspetto grafico
manifest.webmanifest      configurazione dell'app installabile
sw.js                     service worker (offline + aggiornamenti automatici)
icon-192.png              icone
icon-512.png
apple-touch-icon.png
js/
  state.js                dati, costanti, icone, salvataggio locale, copie automatiche
  calc.js                 calcoli: date, ricorrenze, importi, formattazione
  drive.js                sincronizzazione Google Drive e lettura fatture da Excel
  charts.js               grafici del Riepilogo
  render.js               disegno di tutte le schermate
  forms.js                moduli: spese, categorie, modelli, bollette
  scan.js                 scansione scontrini con IA
  backup.js               esporta/importa e forzatura aggiornamento
  ui.js                   conferme e messaggi "annulla"
  events.js               gestione di tutti i clic e degli overlay
  app.js                  avvio dell'applicazione
```

**L'ordine di caricamento conta**: i file sono richiamati in fondo a `index.html`
nella sequenza corretta (state → calc → drive → charts → render → forms → scan →
backup → ui → events → app). Se ne aggiungi uno nuovo, inseriscilo nel punto giusto
sia in `index.html` sia nell'elenco `SHELL` di `sw.js`.

## Come aggiornare l'app

1. Modifica il file che ti serve (es. `js/render.js`).
2. Aggiorna il numero di versione in `js/state.js` (`APP_V`) e in `sw.js` (`CACHE`).
3. Carica i file modificati su GitHub.

Il service worker usa una strategia *network-first*: se c'è connessione, l'app
scarica sempre la versione più recente all'apertura. Non serve più il pulsante
"Cerca aggiornamenti", che resta comunque disponibile in Impostazioni.

## Funzioni principali

**Spese** — voci una tantum e ricorrenti (da mensili ad annuali), categorie con
colore personalizzabile, spese variabili (bollette) che stimano l'importo futuro
sullo storico, catalogo di voci suggerite, ricerca per nome/categoria/importo.

**Entrate** — inserimento manuale (anche ricorrente) e importazione automatica
delle fatture dai file `Riepilogo_20XX.xlsx` su Google Drive. Il nome del file
determina l'anno delle fatture. Categorie entrata con aliquota propria.

**Calendario** — entrate in verde e uscite in rosso nello stesso calendario, con
filtro Tutto / Entrate / Uscite.

**Risparmi** — fondo tasse calcolato automaticamente con aliquote per categoria
(e forzatura sulla singola voce), più obiettivi di risparmio con barre di avanzamento.

**Riepilogo** — totale del mese, ripartizione per categoria, approfondimenti
automatici sui tuoi dati e tre grafici di andamento con intervallo regolabile
(3, 6, 12 o 24 mesi).

**Scansione IA** — fotografa uno scontrino e l'app ne estrae importo, data e
categoria (richiede una chiave API Groq gratuita, salvata solo sul dispositivo).

## Sicurezza dei dati

- I dati restano sul dispositivo (`localStorage`) e, se attivi la sincronizzazione,
  nello spazio riservato dell'app su Google Drive.
- L'app conserva **una copia automatica al giorno degli ultimi 7 giorni**,
  ripristinabile da Impostazioni.
- Con "Esporta" ottieni un file di backup completo in formato JSON.
- La chiave API e l'ID client Google **non** finiscono nei backup, per sicurezza:
  vanno reinseriti a mano su un nuovo dispositivo.

## Configurazione Google Drive

1. Su Google Cloud Console crea un progetto e abilita l'API Google Drive.
2. Crea credenziali OAuth di tipo *Web application*, con origine JavaScript
   `https://<tuo-utente>.github.io` (senza percorso e senza barra finale).
3. In "Pubblico" aggiungi il tuo indirizzo Gmail come utente di prova.
4. Incolla l'ID client in Impostazioni → Google Drive.

## Requisiti

Nessuna compilazione, nessuna dipendenza da installare. Le uniche librerie esterne
(Chart.js, SheetJS, Google Identity) sono caricate da CDN.
