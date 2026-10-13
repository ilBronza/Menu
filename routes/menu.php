<?php

use IlBronza\Menu\Http\Controllers\MenuItemsController;
use Illuminate\Support\Facades\Route;

Route::middleware(['web', 'auth'])->get('il-bronza/menu/items/{id}', MenuItemsController::class)
    ->where('id', 'm-[a-f0-9]{64}')
    ->name('ilBronza.menu.items');

Route::middleware(['web', 'auth'])->get('il-bronza/menu/fetch-menu', function ()
{
	return app('menu')->render();
})->name('ilBronza.menu.fetchMenu');
