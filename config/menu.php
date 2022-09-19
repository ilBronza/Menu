<?php

return [


	'usesSession' => env('MENU_USES_SESSION', false),



	'serviceProviders' => [
		'accountmanager',
		'filecabinet'
	],


	'childrenPerColumn' => 10
];