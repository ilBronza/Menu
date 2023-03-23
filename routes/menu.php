<?php


Route::middleware(['web', 'auth'])->get('il-bronza/menu/fetch-menu', function ()
{
	return app('menu')->render();
})->name('ilBronza.menu.fetchMenu');
