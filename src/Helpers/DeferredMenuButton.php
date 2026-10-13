<?php

namespace IlBronza\Menu\Helpers;

use IlBronza\Buttons\Button;

/** Preserve the Blade dropdown layout without rendering any descendants. */
class DeferredMenuButton extends Button
{
    public function navbarRender(string $type = 'horizontal')
    {
        return '<!--ib-menu-slot-->';
    }
}
