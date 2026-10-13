# Menu
 Menu generator

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
   Le riaperture nella stessa pagina non ripetono il download. Un errore mostra
   un pulsante «Riprova» e non viene memorizzato come risultato valido.

La struttura HTML e le classi UIkit restano quelle del menu tradizionale:
`li > a`, icona `uk-nav-parent-icon` dentro il link, dropdown e griglie originali,
hamburger in `ul.uk-navbar-nav > li` e contenitore `uk-width-xlarge` nel laterale.
Il renderer aggiunge soltanto classi e attributi per gestire stato e accessibilità;
gli stili dei link continuano a provenire dal framework e dal progetto.
I dropdown della navbar usano il componente UIkit `drop` con le classi originali;
quelli annidati mantengono `dropdown`. Il posizionamento fa riferimento al link,
e viene ricalcolato dopo il caricamento dei figli. Restano validi `dropdownWidth`
per una larghezza esplicita e `childrenPerColumn` per la disposizione in colonne.

Le voci che hanno sia un link sia figli conservano il collegamento; cliccando
l'icona già presente nel link si espande il sottomenu. Per i gruppi senza un URL
si può cliccare anche sul testo. Sono esportati icone, immagini, badge,
contatori, classi, attributi `data-*`, target, conferme, toggle e lightbox/iframe.
Il testo e i badge conservano il comportamento HTML delle viste esistenti:
devono quindi provenire da contenuti attendibili o essere sanificati dal progetto.
I frammenti delle voci vengono renderizzati sul server tramite `navbarRender()`.
Le personalizzazioni devono mantenere il link, l'icona del genitore e il contenitore
del sottomenu attesi dalle viste UIkit; per strutture diverse usare il rendering
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

### Compatibilità e costi

Tutte le voci da caricare successivamente devono essere ricostruibili tramite
`menu.serviceProviders` e `MenuItems::loadProjectMenuItems()`. Una voce aggiunta
soltanto nel controller della pagina non esiste nella successiva richiesta del
ramo: spostare quella definizione nei provider oppure disabilitare la modalità
progressiva per quella pagina.

I provider attuali continuano a costruire l'albero sul server: questa modifica
riduce HTML, dati trasferiti inizialmente e nodi DOM, ma non rende differite le
query eseguite dai provider. Ogni primo accesso a un ramo comporta una richiesta
HTTP. La cache dei rami è solo in memoria nella pagina, senza localStorage o
riutilizzo tra utenti o navigazioni. La cache HTML Laravel del menu viene evitata
nella modalità progressiva, così il payload iniziale riflette il contesto corrente.

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
`UIKIT_CSS_PATH` ai file UIkit del progetto si eseguono anche i due test di
integrazione con UIkit, altrimenti saltati. I test verificano la creazione
differita del laterale, la condivisione delle richieste, i tentativi dopo errore,
la navigazione da tastiera e la compatibilità con inserimenti AJAX.
Il test PHP `MenuHtmlContractTest` può esportare un confronto completo per il
browser: impostare `MENU_HTML_FIXTURE_PATH` a un percorso scrivibile durante la
suite PHP e usare lo stesso valore nella suite JavaScript. I test confrontano
struttura e classi con l'HTML Blade reale, anche con menu sticky e più colonne,
e gli stili dei link con UIkit. Il confronto a dropdown aperti verifica anche
larghezze automatiche ed esplicite, padding e allineamento al link, sui due livelli
e a diverse dimensioni della finestra.
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
