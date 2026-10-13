<?php

namespace IlBronza\Menu\Tests;

use IlBronza\Buttons\ButtonsServiceProvider;
use IlBronza\Menu\MenuServiceProvider;
use IlBronza\Menu\Tests\Fixtures\TestMenu;
use IlBronza\UikitTemplate\UikitTemplate;
use Orchestra\Testbench\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function getPackageProviders($app)
    {
        return [MenuServiceProvider::class, ButtonsServiceProvider::class];
    }

    protected function defineEnvironment($app)
    {
        $app['config']->set('app.key', 'base64:' . base64_encode(str_repeat('m', 32)));
        $app['config']->set('app.locale', 'it');
        $app['config']->set('app.template', UikitTemplate::class);
        $app['config']->set('cache.default', 'array');
        $app['config']->set('session.driver', 'array');
        $app['config']->set('menu.serviceProviders', []);
        $app['config']->set('menu.logo.show', false);
    }

    protected function setUp(): void
    {
        parent::setUp();

        $this->app->instance('menu', new TestMenu());
    }

    protected function menu(): TestMenu
    {
        return $this->app->make('menu');
    }
}
