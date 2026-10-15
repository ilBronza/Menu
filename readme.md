# Menu
 Menu generator

## Voce attiva e percorso corrente

Il menu riconosce automaticamente il collegamento alla pagina corrente e
evidenzia anche tutti i suoi antenati, nel rendering tradizionale e progressivo.
Il confronto usa il percorso esatto dell'URL, ignorando query string, frammenti
e slash finale; i link esterni e i pulsanti disabilitati, AJAX, submit o toggle
non vengono selezionati automaticamente. I link generati con `route` o
`routeName` funzionano allo stesso modo e distinguono i parametri della route.

Per associare una voce a più route, per esempio mantenere «Clienti» evidenziato
anche nelle pagine di dettaglio e modifica, specificare `activeRoutes`:

```php
$menu->createButton([
    'name' => 'clients',
    'text' => 'Clienti',
    'href' => route('clients.index'),
    'activeRoutes' => ['clients.*'], // Sono ammessi anche nomi esatti o una stringa.
]);
```

Quando presente, `activeRoutes` sostituisce il confronto dell'URL. I valori
espliciti `active => true` e `active => false` hanno precedenza sul riconoscimento
automatico. Lo stato attivo di un figlio visibile si propaga agli antenati anche
quando è impostato manualmente; i rami non accessibili non contribuiscono allo stato.

Alla prima apertura del menu mobile viene aperto il percorso verso la voce
attiva. Nel menu progressivo vengono scaricati soltanto i rami di quel percorso,
senza caricare gli altri; la navbar desktop mantiene i dropdown chiusi.
Le chiusure successive dell'utente vengono rispettate. Per il menu mobile
tradizionale importare lo stesso entry point JavaScript descritto sotto:
l'apertura del percorso usa i controller Nav di UIkit.

Le due funzioni si possono disattivare separatamente:

```php
// config/menu.php
'active' => [
    'automatic' => false,
    'openMobilePath' => false,
],
```

Nel menu progressivo gli identificatori della voce attiva e degli antenati sono
inclusi nel payload iniziale: le richieste dei rami mantengono il contesto della
pagina aperta. Anche `renderFetcher()` trasmette l'URL della pagina d'origine
quando l'intero menu viene caricato via AJAX. La cache HTML tradizionale
distingue le pagine per evitare che una voce resti evidenziata dopo aver
cambiato destinazione.

## Menu progressivo

Il menu può inviare soltanto le voci principali in JSON e costruire l'interfaccia
nel browser. I figli di una voce vengono scaricati alla sua prima apertura. Il
menu laterale viene creato soltanto al clic sull'hamburger e usa gli stessi dati
già caricati dal menu desktop.

La modalità è **opzionale**, per mantenere compatibili i progetti che aggiungono
voci nei controller o personalizzano le viste Blade. Per attivarla:

```dotenv
MENU_PROGRESSIVE=true
```

Oppure impostare `menu.progressive.enabled` a `true` nella configurazione. Se la
configurazione Laravel è in cache, rigenerarla dopo il cambiamento. È possibile
scegliere anche sul singolo menu, prima del rendering:

```php
app('menu')->setProgressive(true);
// Rendering tradizionale per una pagina con voci locali o viste personalizzate:
app('menu')->setProgressive(false);
```

L'attivazione riguarda il menu orizzontale UIkit standard. I menu verticali,
i template alternativi e le cartelle di viste personalizzate mantengono il
rendering esistente. La chiamata `app('menu')->render()` nel layout resta la stessa.

### JavaScript nel bundle Webpack / Laravel Mix

Il pacchetto segue la convenzione usata da Idealpack: i sorgenti dei pacchetti
vengono importati direttamente da `vendor/ilbronza` in `resources/js/app.js`,
poi Laravel Mix li compila insieme in `public/js/app.js`.

L'entry point pubblico di Menu è `resources/assets/js/ilBronza.menu.js`, che
carica il renderer interno `progressive-menu.js`. In `resources/js/app.js` del
progetto aggiungere il `require` di Menu subito dopo quello di UikitTemplate:

```js
require('../../vendor/ilbronza/uikittemplate/resources/assets/js/ilBronza.uikittemplate.js');
require('../../vendor/ilbronza/menu/resources/assets/js/ilBronza.menu.js');
```

Poi ricompilare il normale bundle con il comando già usato dal progetto, ad esempio
`npm run production` con Laravel Mix. In uno sviluppo tramite checkout locali,
Composer può collegare il pacchetto dentro `vendor` come fa Idealpack: gli import
rimangono identici. Non è necessario pubblicare o copiare questi file in
`resources/js` dell'applicazione. Il renderer si inizializza da solo al
caricamento del DOM e gestisce anche menu inseriti successivamente via AJAX.

Il layout carica il bundle dell'applicazione; la vista del menu contiene soltanto
contenitori e dati nel tag `<script type="application/json">`. Questo tag non
esegue codice. Compilazione, minificazione e versionamento del JavaScript sono
gestiti dalla pipeline Webpack/Mix del progetto. UIkit e le icone provengono dal
layout esistente.

### Come funziona

1. Il server carica i provider e `App\Providers\Helpers\MenuItems` una sola volta
   per istanza del menu. Il servizio è limitato al ciclo della richiesta, anche
   nei worker persistenti.
2. Il documento include un payload JSON con metadati delle navbar e le sole voci
   di primo livello. Ogni voce contiene i frammenti HTML desktop e mobile prodotti
   dalle stesse viste Blade del menu tradizionale, senza renderizzare i figli.
   Lo script condiviso costruisce la barra principale.
3. Una voce con figli contiene `hasChildren` e `childrenUrl`. Aprendola con mouse,
   clic o tastiera si richiedono soltanto i suoi figli diretti. I livelli più
   profondi seguono lo stesso meccanismo.
4. L'hamburger crea il pannello laterale usando le voci principali già presenti;
   aprirlo non scarica automaticamente tutti i rami.
5. Richieste in corso e risultati vengono condivisi tra le due presentazioni.
   Le riaperture nella stessa pagina non ripetono il download. Gli errori
   temporanei mostrano «Riprova» e non vengono memorizzati come risultati validi.

Entrambe le modalità usano il markup UIkit: `li > a`, `uk-navbar-dropdown` nella
barra principale, `uk-dropdown` nei livelli annidati e `uk-drop-grid` nelle griglie.
Le vecchie classi delle griglie rimangono come alias per i temi inclusi in
UikitTemplate. Le icone sono `uk-navbar-parent-icon`, `uk-drop-parent-icon` e
`uk-nav-parent-icon` secondo il contesto. L'hamburger `uk-navbar-toggle` si trova
dentro la navbar; il pannello laterale segue la larghezza di `uk-offcanvas-bar`,
senza contenitori interni a larghezza fissa.

UIkit gestisce apertura, chiusura, hover e accordion mobile. Il renderer carica
i figli sugli eventi del framework e aggiorna il posizionamento dopo il download.
Le larghezze della navbar seguono il numero di colonne tramite
`uk-navbar-dropdown-width-N`; la sesta colonna usa una larghezza esplicita di
1200px, perché UIkit fornisce i modificatori fino a cinque colonne. `dropdownWidth`
ha precedenza per una larghezza personalizzata. `childrenPerColumn` stabilisce
quante voci inserire in ciascuna colonna. `setDropdownColumns()` ha precedenza e
distribuisce le voci fra il numero di colonne richiesto. I gruppi senza
destinazione usano `href="#"`.

Le voci con link e figli mantengono il comportamento nativo: il primo clic apre
un dropdown chiuso, un clic sul link già aperto permette la navigazione; i gruppi
senza destinazione si aprono e chiudono con il clic. Per le voci che eseguono
azioni esterne, come toggle o chiamate AJAX, un pulsante separato apre il sottomenu
senza sostituire l'azione del link. Sono esportati icone, immagini, badge,
contatori, classi, attributi `data-*`, target, conferme, toggle e lightbox/iframe.
Il testo e i badge conservano il comportamento HTML delle viste esistenti:
devono quindi provenire da contenuti attendibili o essere sanificati dal progetto.
I frammenti delle voci vengono renderizzati sul server tramite `navbarRender()`.
Le personalizzazioni devono mantenere il link e il contenitore del sottomenu
attesi dalle viste UIkit; per strutture diverse usare il rendering
tradizionale o adattare il renderer.

### Contratto e accesso

- `GET il-bronza/menu/items/{id}` (`ilBronza.menu.items`) restituisce
  `{ "id": "…", "items": […] }`, con un solo livello di profondità.
- La route usa i middleware `web` e `auth`. La visibilità viene controllata sul
  server a ogni richiesta, inclusi tutti gli antenati del ramo. Si mantengono le
  regole di ruolo del renderer esistente; la proprietà `permissions` dei pulsanti
  non introduce controlli ulteriori rispetto a quelli già applicati dal pacchetto.
- Foglie, rami inesistenti e rami non accessibili restituiscono `404`. Le risposte
  JSON hanno `Cache-Control: private, no-store`.
- Gli identificatori derivano dalla navbar e dal percorso dei nomi, non dagli ID
  casuali usati per l'HTML. Assegnare nomi stabili alle voci, preferibilmente unici
  tra fratelli, e costruire il menu nello stesso contesto nelle richieste dei rami.
- Il JavaScript del renderer è incluso nel bundle dell'applicazione e non
  contiene dati dell'utente. Le route del pacchetto servono i dati dei rami e il
  menu, non gli asset JavaScript.

### Errori e scadenza della sessione

Ogni download ha un timeout predefinito di dieci secondi, condiviso da desktop
e mobile e applicato anche alla lettura del JSON. Alla scadenza la richiesta
viene annullata quando il browser supporta `AbortController`; il caricamento
si sblocca comunque e permette un nuovo tentativo. Una risposta tardiva non
può sostituire i dati di un tentativo successivo o finire nella cache.

- Problemi di rete, timeout, errori server e risposte non valide mostrano un
  messaggio e «Riprova».
- `403` mostra accesso negato; `404` e `410` mostrano voci non più disponibili,
  senza «Riprova». I rami nascosti continuano a restituire `404`.
- `401`, `419` e un redirect all'URL di login configurato mostrano la sessione
  scaduta. Il menu svuota la propria cache, sostituisce i rami già caricati
  con il messaggio e interrompe nuovi download nella pagina corrente.

Il collegamento «Accedi» usa la route dell'applicazione chiamata `login`, se
disponibile, oppure `menu.progressive.loginUrl`. Se manca un URL valido, viene
mostrato «Ricarica la pagina», lasciando all'applicazione il normale flusso di
autenticazione. Il menu non avvia automaticamente una navigazione.

```php
// config/menu.php
'progressive' => [
    'enabled' => env('MENU_PROGRESSIVE', false),
    'requestTimeoutMs' => 10000,
    'loginUrl' => null, // Oppure '/sso/sign-in' o l'URL del proprio servizio di accesso.
],
```

I messaggi sono tradotti in italiano e inglese e vengono annunciati come
avvisi accessibili. I dettagli grezzi degli errori restituiti dal server
non vengono inseriti nel menu.

### Cache dei rami nel browser

Per gli utenti autenticati il renderer conserva i rami scaricati in
`sessionStorage`, riutilizzandoli anche dopo navigazioni e ricariche nella
stessa scheda. La scadenza predefinita è di cinque minuti dal download,
senza rinnovo a ogni lettura; vengono conservati al massimo 50 rami.

La cache è separata per utente, sessione, lingua e contesto applicativo.
Ogni ramo ha una firma dei dati visibili, inclusi i discendenti: cambiamenti
nelle voci accessibili, nei link, nei badge, nei contatori o negli attributi
invalidano il risultato salvato. Gli ID HTML casuali e lo stato attivo della
pagina non cambiano la firma. Evidenziazione e apertura del percorso vengono
applicate usando il manifest corrente, anche quando i figli arrivano dalla cache.

```php
// config/menu.php
'browserCache' => [
    'enabled' => true,
    'ttlSeconds' => 300,
    'maxEntries' => 50,
    'version' => '1',
    'context' => null,
],
```

Per applicazioni multi tenant, impostare `menu.browserCache.context` nel
middleware con l'identificativo del tenant corrente, prima di renderizzare il menu:

```php
config(['menu.browserCache.context' => (string) $tenant->getKey()]);
```

Incrementare `version` dopo cambiamenti alle viste personalizzate dei pulsanti.
Impostare `enabled` a `false` o `ttlSeconds` a `0` per disattivare lo storage.
Il cambio di utente, sessione o contesto sostituisce la cache precedente; un
manifest anonimo o con cache disattivata cancella i rami salvati dal renderer.

Errori HTTP e risposte non valide non vengono salvati. Storage bloccato,
pieno o corrotto non impedisce la navigazione: resta disponibile la cache in
memoria della pagina e il normale download dei rami. Le risposte HTTP
mantengono `Cache-Control: private, no-store`.

### Compatibilità e costi

Tutte le voci da caricare successivamente devono essere ricostruibili tramite
`menu.serviceProviders` e `MenuItems::loadProjectMenuItems()`. Una voce aggiunta
soltanto nel controller della pagina non esiste nella successiva richiesta del
ramo: spostare quella definizione nei provider oppure disabilitare la modalità
progressiva per quella pagina.

I provider attuali continuano a costruire l'albero sul server: questa modifica
riduce HTML, dati trasferiti inizialmente e nodi DOM, ma non rende differite le
query eseguite dai provider. Un ramo viene richiesto quando manca una copia
valida nella cache della pagina o in `sessionStorage`. La cache HTML Laravel
del menu viene evitata nella modalità progressiva, così il payload iniziale
e le firme dei rami riflettono il contesto corrente.

Il renderer richiede JavaScript; con JavaScript disabilitato vengono mostrati i
collegamenti diretti di primo livello. Il rendering tradizionale resta disponibile
per i progetti che richiedono navigazione completa senza JavaScript.

Anche nella modalità tradizionale le voci ora vengono caricate una sola volta e
il rendering off-canvas ripristina l'orientamento originale del menu.

### Verifica

La suite PHP copre esportazione per livello, ruoli e antenati, identificatori,
metadati dei pulsanti, rendering tradizionale, caricamento unico e separazione
tra dati nella vista e codice JavaScript nel bundle.
Nel workspace dei pacchetti può essere eseguita con il runner condiviso:

```bash
python3 ../.ibtest/bin/ibtest.py Menu
```

I test del browser richiedono Playwright e Chrome disponibili nell'ambiente:

```bash
node --test tests/js/progressive-menu.test.cjs
```

`NODE_PATH` può indicare una directory `node_modules` già installata;
`CHROME_PATH` un eseguibile Chrome alternativo. Impostando `UIKIT_JS_PATH` e
`UIKIT_CSS_PATH` ai file UIkit del progetto si eseguono anche i test di
integrazione con UIkit, altrimenti saltati. I test verificano la creazione
differita del laterale, la condivisione delle richieste, i tentativi dopo errore,
la navigazione da tastiera, la compatibilità con inserimenti AJAX e la cache
tra navigazioni, incluse scadenza, invalidazione e indisponibilità dello storage.
Sono verificati anche timeout condivisi, corpi JSON bloccati, risposte tardive,
errori di rete, accesso negato, rami non disponibili e sessioni scadute.
Il test PHP `MenuHtmlContractTest` può esportare un confronto completo per il
browser: impostare `MENU_HTML_FIXTURE_PATH` a un percorso scrivibile durante la
suite PHP e usare lo stesso valore nella suite JavaScript. I test confrontano
struttura e classi con l'HTML Blade reale, anche con menu sticky e più colonne,
e gli stili dei link con UIkit. Il confronto a dropdown aperti verifica anche
larghezze automatiche ed esplicite, padding e allineamento al link, sui due livelli
e a diverse dimensioni della finestra.
Sono verificati anche i controller Nav e Offcanvas nativi, l'assenza di overflow
del pannello mobile e i link che hanno sia una destinazione sia un sottomenu.
`MENU_JS_PATH` permette di eseguire gli stessi test su un bundle Webpack compilato
contenente il renderer, invece che sul file sorgente.

## Esempio di creazione

``` bash
declare App\Providers\Helpers\MenuItems

```



	$menu = app('menu');

	$menu->setUsesCache(false);

	$buttons = [];

	$item = $menu->createButton([
		'name' => 'manzone',
	]);
	$item->setText('manzallone');
	$item->addIcon('address-card');


	foreach(['masd', 'uasjh', '134', 'qd', 'dwdw', 'dac', 'vfeb', 'er', '134', 'awsdwef'] as $name)
	{
		$child = $menu->createButton([
			'name' => $name,
		]);
		$child->setText($name);

		$item->addChild($child);
	}

	$item->setDropdownColumns(4);

	$item = $menu->createButton([
		'name' => 'fraccarone'
	]);
	$item->addIcon('handshake');
	$item->setText('manzallato');

	$item = $menu->createButton([
		'name' => 'mamnama'
	]);
	$item->setText('ioscolaaro');
	$item->addIcon('feather');

	$menu->moveItemToNavbar($item, 'manzarotta');
