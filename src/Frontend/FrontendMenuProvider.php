<?php

namespace IlBronza\Menu\Frontend;

interface FrontendMenuProvider
{
    public function build(FrontendMenu $menu, object $context): void;
}
