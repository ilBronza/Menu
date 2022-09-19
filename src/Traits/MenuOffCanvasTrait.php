<?php

namespace IlBronza\Menu\Traits;

use IlBronza\Buttons\Button;
use IlBronza\Menu\Navbar;

trait MenuOffCanvasTrait
{
    public function hasOffCanvas()
    {
        return true;
    }

    public function setOffCanvasButton() : Button
    {
        $this->offCanvasButton = Button::create([
            'name' => 'offcanvas'
        ]);

        $this->offCanvasButton->setToggle(
            $this->getContainerId()
        );

        $this->offCanvasButton->setIcon('bars');

        return $this->offCanvasButton;
    }

    public function getOffCanvasButton() : Button
    {
        if(! $this->offCanvasButton)
            return $this->setOffCanvasButton();

        return $this->getOffCanvasButton();
    }    
}