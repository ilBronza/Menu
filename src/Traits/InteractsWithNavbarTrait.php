<?php

namespace IlBronza\Menu\Traits;

use IlBronza\Menu\Navbar;

trait InteractsWithNavbarTrait
{
    public function getNavbar() : ? Navbar
    {
        return $this->navbar ?? null;
    }

    public function removeFromNavbar() : static
    {
        if($navbar = $this->getNavbar())
            $navbar->removeButton($this);

        $this->navbar = null;

        return $this;
    }

    public function addToNavbar(Navbar $navbar) : static
    {
        $navbar->addButton($this);
        $this->navbar = $navbar;

        return $this;
    }
}