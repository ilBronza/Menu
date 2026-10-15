<?php

return [
	// 'usesCache' => env('MENU_USES_CACHE', false),
	'usesCache' => false,

	// Enable when all branches are defined in menu providers or MenuItems.
	// Controller-only branches require the traditional rendering path.
	'progressive' => [
		'enabled' => env('MENU_PROGRESSIVE', false),
		'requestTimeoutMs' => 10000,
		// Null uses the application's named login route, when available.
		'loginUrl' => null,
	],

	'active' => [
		'automatic' => true,
		'openMobilePath' => true,
	],


	'serviceProviders' => [
		'accountmanager',
		'clients',
		'operators',
		'courses',
		'CRUDMenuUtilities',
		'translationsmenumanager'
	],

	'buttons' => [
		'dropdownMode' => 'hover',
	],

	'childrenPerColumn' => 10,

	'logo' => [
		// 'path' => env(
		// 	'MENU_LOGO_PATH',
		// 	'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Google_logo_%282013-2015%29.svg/750px-Google_logo_%282013-2015%29.svg.png'),
		'show' => true,
		'path' => env(
			'MENU_LOGO_PATH',
			'/img/logo-one.jpeg'),
		'width' => env(
			'MENU_LOGO_WIDTH',
			'80px'),
	],

	'navbar' => [
		'sticky' => false,
		'stickyOffset' => 80,
	],
];
