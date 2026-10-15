# Changelog

All notable changes to `Menu` will be documented in this file.

## Unreleased — Menu progressivo

- Timeout configurabile dei rami, cancellazione della richiesta e messaggi
  distinti per rete, accesso negato, ramo non disponibile e sessione scaduta.
- Collegamento al login o ricarica della pagina alla scadenza della sessione,
  con svuotamento della cache e recupero dei soli errori temporanei tramite «Riprova».
- Cache dei rami in `sessionStorage` tra navigazioni, con scadenza e limite
  configurabili, separazione per utente/sessione/lingua/contesto e firme dei
  contenuti visibili; lo stato attivo viene applicato dal manifest corrente.
- Voce attiva riconosciuta dall'URL corrente o da pattern di route `activeRoutes`,
  con precedenza agli stati manuali e propagazione agli antenati visibili.
- Apertura del percorso corrente al primo accesso al menu mobile, mantenendo
  il contesto della pagina nei rami progressivi e rispettando le chiusure dell'utente.
- Cache HTML del menu separata per pagina per preservare la voce attiva.
- Markup e controller UIkit nativi: icone per contesto, griglie `uk-drop-grid`,
  larghezze per numero di colonne, hamburger dentro la navbar e laterale fluido.
- Corretta la divisione con `childrenPerColumn = 1` e il setter delle colonne
  nelle viste condivise di Buttons, usate anche dal rendering tradizionale.
- Modalità JSON opzionale: primo livello nel documento, rami caricati alla prima apertura.
- Pannello laterale creato al clic e dati condivisi con il menu desktop.
- Endpoint autenticato con controllo dei ruoli anche sugli antenati.
- Entry point `ilBronza.menu.js`, importato da `vendor` nel bundle Webpack/Mix
  del progetto secondo la convenzione di Idealpack.
- Accesso da tastiera, gestione errori e riprova.
- Caricamento unico dei provider per richiesta e ripristino orientamento off-canvas.
- HTML progressivo generato dalle viste dei pulsanti tradizionali, mantenendo
  link, icone, colonne, hamburger e struttura off-canvas compatibili con UIkit.
- Corretti componente UIkit e ancoraggio dei dropdown progressivi, preservando
  larghezze e stili della navbar e ricalcolando la posizione dopo il caricamento.

## Version 1.0

### Added
- Everything
