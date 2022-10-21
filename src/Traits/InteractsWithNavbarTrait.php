<?php

namespace IlBronza\Menu\Traits;

use IlBronza\Menu\Navbar;

trait InteractsWithNavbarTrait
{
    public function isNavbarButton() : bool
    {
        if($this->isChild())
            return $this->parent->isNavbarButton();

        return !! $this->navbar;
    }

    public function getNavbar() : ? Navbar
    {
        return $this->navbar ?? null;
    }

    public function removeFromNavbar() : self
    {
        if($navbar = $this->getNavbar())
            $navbar->removeButton($this);

        $this->navbar = null;

        return $this;
    }

    public function addToNavbar(Navbar $navbar) : self
    {
        $navbar->addButton($this);
        $this->navbar = $navbar;

        return $this;
    }
}