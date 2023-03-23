<?php

namespace IlBronza\Menu\Traits;

use Auth;
use IlBronza\Menu\Navbar;
use IlBronza\UikitTemplate\Fetcher;
use Illuminate\Support\Facades\Log;
use Illuminate\View\View;

trait MenuRenderTrait
{
    public function setUsesCache(bool $usesCache)
    {
        $this->usesCache = $usesCache;
    }

    public function usesCache()
    {
        if(is_null($this->usesCache))
            return config('menu.usesCache');

        return $this->usesCache;
    }

    public function getCacheMenuName(string $type) : string
    {
        return Auth::id() . "iBMenu{$type}";
    }

    public function getFromCache(string $type) : ? string
    {
        $menuName = $this->getCacheMenuName($type);

        return cache($menuName);
    }

    public function renderFromCache(string $type) : string
    {
        if($result = $this->getFromCache($type))
            return $result;

        $result = $this->_render($type);

        $menuName = $this->getCacheMenuName($type);

        cache([$menuName => $result]);

        return $result;
    }

    public function _render(string $type) : string
    {
        $this->loadItemsFromServiceProviders();

        $this->loadItemsFromProject();

        $viewName = $this->getViewName($type);

        return view($viewName, ['menu' => $this])->render();
    }

    public function render(string $type = 'horizontal')
    {
        // Log::error('chiamato ilBronza Menu MenuRenderTrait due volte render per verticale e offcanvas, ridurre oggetto nel service provider');

        if($this->usesCache($type))
            return $this->renderFromCache($type);

        return $this->_render($type);
    }

    public function renderFetcher()
    {
        $fetcher = new Fetcher([
            'url' => route('ilBronza.menu.fetchMenu')
        ]);

        return $fetcher->render();
    }

    
}