<?php

namespace IlBronza\Menu\Tests\Fixtures;

use Closure;
use IlBronza\Menu\Menu;

/** Menu supplied by the host application, with observable item-loading hooks. */
class TestMenu extends Menu
{
    public int $providerLoads = 0;
    public int $projectLoads = 0;
    public ?Closure $onProviderLoad = null;
    public ?Closure $onProjectLoad = null;

    public function __construct()
    {
        parent::__construct();

        $this->setViewFolder('menu');
    }

    public function loadItemsFromServiceProviders()
    {
        $this->providerLoads++;

        if ($this->onProviderLoad) {
            ($this->onProviderLoad)($this);
        }
    }

    public function loadItemsFromProject()
    {
        $this->projectLoads++;

        if ($this->onProjectLoad) {
            ($this->onProjectLoad)($this);
        }
    }
}
