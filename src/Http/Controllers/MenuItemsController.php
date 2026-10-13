<?php

namespace IlBronza\Menu\Http\Controllers;

use IlBronza\Menu\Helpers\MenuPayloadBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

class MenuItemsController extends Controller
{
    public function __invoke(string $id) : JsonResponse
    {
        $payload = (new MenuPayloadBuilder(app('menu')))->children($id);

        return response()->json($payload)->header('Cache-Control', 'private, no-store');
    }
}
