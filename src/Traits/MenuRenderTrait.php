<?php

namespace IlBronza\Menu\Traits;

use Auth;
use IlBronza\Menu\Navbar;
use IlBronza\UikitTemplate\Fetcher;
use Illuminate\Support\Facades\Log;
use Illuminate\View\View;

trait MenuRenderTrait
{
    public function _render() : string
    {
        $this->loadItemsFromServiceProviders();

        $this->loadItemsFromProject();

        // if($this->hasOffCanvas())
        // {
        //     $mainRightBar = $this->provideMainRightBar();
        //     $offCanvasButton = $this->getOffCanvasButton();

        //     $this->addToNavbar($offCanvasButton, $mainRightBar);

        //     $offCanvasButton->setLast();
        // }

        $viewName = $this->getViewName();

        return view($viewName, ['menu' => $this])->render();
    }

    public function renderFetcher()
    {
        $fetcher = new Fetcher([
            'url' => route('ilBronza.menu.fetchMenu')
        ]);

        $fetcher->setRefresh(false);

        return $fetcher->render();
    }

    public function renderOffcanvas()
    {
        $this->setOrientation('offCanvas');

        return $this->_render();
    }
    
}