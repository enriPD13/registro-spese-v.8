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
  forecast.js             previsioni di cassa (profilo stagionale, proiezioni)
  calendar.js             agenda Google, tariffe orarie, incasso gia' impegnato
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

**Previsioni** — stima di cassa costruita sulle abitudini reali di incasso: dagli
anni completi si ricava quanto pesa ogni mese sul totale annuo (profilo stagionale),
si proietta il totale dell'anno in corso a partire dai mesi già chiusi e lo si
ridistribuisce sui mesi futuri. Le voci ricorrenti non sono stimate ma calcolate.
La vista annuale usa esclusivamente gli anni completi, escludendo quello in corso.

Gli anni non pesano tutti uguale: ogni anno più vecchio vale il 60% del successivo
(circa 51/31/18% con tre anni), così il modello segue i cambiamenti reali
dell'attività senza buttare via lo storico. La tendenza di crescita o calo viene
rilevata automaticamente dalle variazioni annuali, ponderata sulle più recenti e
limitata prudenzialmente fra -40% e +50% l'anno per non estrapolare valori estremi.
Sull'anno in corso la tendenza non viene sommata: l'''andamento dei mesi già chiusi
la contiene già. Quando la variazione recente si discosta dalle precedenti, l'''app
segnala il cambio di passo.

Il modello riconosce la **stabilizzazione**: se le variazioni recenti restano entro
il 5%, le entrate sono considerate stabili e non viene estrapolata alcuna crescita.
Quando invece una crescita c'e', viene **smorzata** (si dimezza a ogni anno
proiettato) e vincolata da un **tetto di capacita'** - il massimo realisticamente
fatturabile in un anno, stimato dal miglior anno realizzato oppure impostato a mano
dalla scheda Previsioni. Serve a evitare l'errore della crescita composta
all'infinito, irrealistica per chi vende il proprio tempo e ha un limite fisico di
giornate lavorabili.

**Tariffe e agenda** - a ogni cliente si associa una tariffa oraria. L'app legge gli
impegni gia' programmati da Google Calendar e riconosce il cliente prima
dall'etichetta del calendario (il modo piu' affidabile: e' una classificazione
voluta dall'utente) e solo in seconda battuta dal titolo dell'evento. Poi calcola
l'incasso impegnato come ore x tariffa (gli eventi "tutto il
giorno" valgono un numero di ore configurabile). Nella previsione mensile quel valore
fa da base minima: se gli impegni superano la stima statistica, e' l'agenda ad avere
ragione. Gli eventi restano sul dispositivo e non vengono sincronizzati.

Il confronto ignora accenti, maiuscole e spazi, e a parita' di corrispondenza vince
il nome piu' lungo (cosi' "Manpower TS" prevale su "Manpower"). Per le grafie che non
combaciano lettera per lettera si usa il campo varianti della tariffa. Se non c'e'
ancora storico fatture ma esistono impegni con tariffa, la previsione parte comunque
dalla sola agenda.

Nelle attivita' lunghe (oltre 6 ore lorde) la pausa viene tolta automaticamente dal
conteggio: un impegno 9-18 vale 8 ore pagate, non 9. La fascia di pausa (13:00-14:00
per impostazione predefinita), il tetto massimo di ore per singola attivita' (8) e le
ore di una giornata intera sono configurabili nella scheda. Le attivita' brevi non
vengono toccate, anche se attraversano la fascia di pausa.

La scheda mostra anche un calendario mensile delle attivita' gia' programmate: ogni
giorno riporta il compenso previsto e un puntino del colore del cliente, e toccando
un giorno si vede il dettaglio di ogni singola attivita' (orario, ore x tariffa,
compenso). Sotto il calendario, l'elenco completo delle attivita' del mese.

E' possibile tenere gli impegni su iCloud e far leggere a Google un calendario
pubblicato: in quel caso Google si "iscrive" al feed iCloud e lo aggiorna con
ritardo (da qualche ora a un giorno). L'app segnala questi calendari come iscritti e
rispetta il nome eventualmente assegnato loro in Google.

La scheda elenca tutti i calendari che l'account Google espone, con il numero di
impegni letti da ciascuno ed eventuali errori: serve a capire subito se un'etichetta
usata sull'iPhone non arriva a Google. Vengono letti anche i calendari deselezionati
o nascosti nell'interfaccia di Google Calendar. Attenzione: i calendari che vivono
solo su iCloud non sono visibili a Google, e quindi nemmeno all'app - vanno ricreati
sotto l'account Google.

Per attivarla: abilitare l'API Google Calendar sul progetto Cloud, ri-autorizzare
l'accesso dall'app (viene chiesto il permesso di sola lettura del calendario) e, se
si usa il calendario Apple, sincronizzarlo con l'account Google dalle impostazioni
dell'iPhone.

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
