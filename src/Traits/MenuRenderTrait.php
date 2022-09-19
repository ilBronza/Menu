<?php

namespace IlBronza\Menu\Traits;

use IlBronza\Menu\Navbar;
use Illuminate\View\View;

trait MenuRenderTrait
{
    public function setUsesSession(bool $usesSession)
    {
        $this->usesSession = $usesSession;
    }

    public function usesSession()
    {
        if(is_null($this->usesSession))
            return config('menu.usesSession');

        return $this->usesSession;
    }

    public function getSessionMenuName(string $type) : string
    {
        return "iBMenu{$type}";
    }

    public function getFromSession(string $type) : ? string
    {
        $menuName = $this->getSessionMenuName($type);

        return session($menuName);
    }

    public function renderFromSession(string $type) : string
    {
        if($result = $this->getFromSession($type))
            return $result;

        $result = $this->_render($type);

        $menuName = $this->getSessionMenuName($type);

        session([$menuName => $result]);

        return $result;
    }

    public function _render(string $type) : View
    {
        $this->loadItemsFromServiceProviders();

        $this->loadItemsFromProject();

        $viewName = $this->getViewName($type);

        return view($viewName, ['menu' => $this]);
    }

    public function render(string $type = 'horizontal')
    {
        if($this->usesSession($type))
            return $this->renderFromSession($type);

        return $this->_render($type);
    }

    
}