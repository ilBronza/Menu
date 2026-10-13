# Changelog

All notable changes to `Menu` will be documented in this file.

## Unreleased — Menu progressivo

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
