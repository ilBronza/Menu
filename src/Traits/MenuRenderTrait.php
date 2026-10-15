<?php

namespace IlBronza\Menu\Traits;

use IlBronza\Menu\Helpers\MenuPayloadBuilder;
use IlBronza\Menu\Helpers\MenuActiveStateResolver;
use IlBronza\Menu\Helpers\MenuFetcher;
use Illuminate\Http\Request;

trait MenuRenderTrait
{
    protected bool $itemsLoaded = false;
    protected bool $itemsLoading = false;
    protected ?bool $progressive = null;
    protected ?MenuActiveStateResolver $activeStateResolver = null;

    public function getActiveRequest() : Request
    {
        return MenuActiveStateResolver::pageRequest(request());
    }

    public function resolveActiveItems() : self
    {
        $this->loadItems();
        $this->activeStateResolver ??= new MenuActiveStateResolver();
        $this->activeStateResolver->resolve($this, $this->getActiveRequest());

        return $this;
    }

    /** Build once even when both the horizontal and off-canvas views are rendered. */
    public function loadItems() : self
    {
        if ($this->itemsLoaded || $this->itemsLoading)
            return $this;

        $this->itemsLoading = true;

        try
        {
            $this->loadItemsFromServiceProviders();
            $this->loadItemsFromProject();
            $this->itemsLoaded = true;
        }
        finally
        {
            $this->itemsLoading = false;
        }

        return $this;
    }

    public function setProgressive(bool $progressive = true) : self
    {
        $this->progressive = $progressive;

        return $this;
    }

    public function usesProgressiveRender() : bool
    {
        return ($this->progressive ?? config('menu.progressive.enabled', false))
            && $this->getOrientation() === 'horizontal'
            && $this->getTemplateName() === 'uikit'
            && $this->getViewFolder() === 'menu';
    }

    public function render()
    {
        // This manifest depends on the current user's visibility and current request.
        if (! $this->usesProgressiveRender() && $this->usesCache())
            return $this->renderFromCache();

        return $this->_render();
    }

    public function _render() : string
    {
        $this->resolveActiveItems();

        if ($this->usesProgressiveRender())
            return view('menu::uikit.menu.progressive', [
                'menu' => $this,
                'payload' => (new MenuPayloadBuilder($this))->root(),
            ])->render();

        $viewName = $this->getViewName();

        return view($viewName, ['menu' => $this])->render();
    }

    public function renderFetcher()
    {
        $fetcher = new MenuFetcher([
            'url' => route('ilBronza.menu.fetchMenu', ['menuPage' => $this->getActiveRequest()->url()])
        ]);

        $fetcher->setRefresh(false);

        return $fetcher->render();
    }

    public function renderOffcanvas()
    {
        $orientation = $this->getOrientation();
        $this->setOrientation('offCanvas');

        try
        {
            return $this->_render();
        }
        finally
        {
            $this->setOrientation($orientation);
        }
    }
    
}
