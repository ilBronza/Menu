<?php

return [
	// 'usesCache' => env('MENU_USES_CACHE', false),
	'usesCache' => false,


	'serviceProviders' => [
		'accountmanager',
		'CRUDMenuUtilities',
		'translationsmenumanager'
	],

	'buttons' => [
		'dropdownMode' => 'click',
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
	]
];