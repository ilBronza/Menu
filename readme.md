# Menu
 Menu generator

``` php
declare App\Providers\Helpers\MenuItems
```

``` php
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

```
<br>
<br>

# Menu with multiple navbars example

``` php

//Instantiates the menu
if(! Auth::user())
        	return;

if(! $menu = app('menu'))
	return;

//Adds a Button to this menu
$settings = $menu->provideButton([
    //...
]);

//Adds children to the Button
$settings->addChildrenFromArray([
	//...
]);

//Adds more Buttons
$import = $menu->provideButton([
    //...
]);

$orders = $menu->provideButton([
    //...
]);

$deliveries = $menu->provideButton([
    //...
]);

//...


//When all necessary buttons have been instantiated, they can be divided into custom subnavbars within the menu

//There are 2 special navbars:
//	default: if custom subnavbars aren't provided and filled, all the created buttons goes here, and is placed in the upper left corner
//  mainRightNavbar: if this navbar is provided with its custom method, it goes on the right and automatically shows user/account button  

$rightNavbar = $menu->provideMainRightBar();//provides (creates or finds and stores in a variable) the special navbar mainRightNavbar
$menu->addToNavbar($settings, $rightNavbar);//Adds the Button $settings to the mainRightNavbar

$firstRowMenu = $menu->provideNavbar('default');//provides (finds and stores in a variable) the special navbar default			
$menu->addToNavbar($import, $firstRowMenu);//Adds the Button $import to the default

$secondRowMenu = $menu->provideNavbar('secondRow');//provides (finds and stores in a variable) the custom navbar secondRow
$secondRowMenu->setPosition('left');//sets the position of the navbar to the left by modifying the uikit class
$secondRowMenu->setBreakRow();//causes a line break in the navbar
$menu->addToNavbar($orders, $secondRowMenu);//Adds the Button $orders to the secondRow


```

