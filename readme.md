# Menu
 Menu generator

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