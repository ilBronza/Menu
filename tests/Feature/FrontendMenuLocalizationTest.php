<?php

namespace IlBronza\Menu\Tests\Feature;

use IlBronza\Menu\Frontend\FrontendMenu;
use IlBronza\Menu\Frontend\FrontendMenuProvider;
use Orchestra\Testbench\TestCase;

class LocalizedMenuObject
{
    public function getPublicUrl(string $locale): string
    {
        return $locale === 'it' ? '/products' : '/en/products?source=menu#details';
    }
}

class LocalizedFrontendMenuItems implements FrontendMenuProvider
{
    public function build(FrontendMenu $menu, object $context): void
    {
        $menu->addTranslated('public_menu.products', $context->item->getPublicUrl($menu->locale()), replace: ['count' => 3]);
        $menu->add('public_menu.literal', '/brand');
    }
}

class FrontendMenuLocalizationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        app()->setLocale('it');
        app('translator')->addLines(['public_menu.products' => ':count prodotti'], 'it');
        app('translator')->addLines(['public_menu.products' => ':count products'], 'en');
    }

    public function test_menu_rebuilds_for_a_language_change_without_changing_page_context(): void
    {
        $menu = new FrontendMenu(['providers' => [LocalizedFrontendMenuItems::class], 'projectProvider' => null]);
        $context = (object) ['locale' => 'it', 'item' => new LocalizedMenuObject];

        $menu->withLanguages(['it', 'en'], 'it', '/choose-language')->build($context);
        $this->assertSame('3 prodotti', $menu->items()[0]['label']);
        $this->assertSame('/products', $menu->items()[0]['url']);

        $menu->withLanguages(['it', 'en'], 'en', '/choose-language')->build($context)->build($context);
        $this->assertCount(2, $menu->items());
        $this->assertSame('3 products', $menu->items()[0]['label']);
        $this->assertSame('/en/products?source=menu#details', $menu->items()[0]['url']);
        $this->assertSame('it', $context->locale);
        $this->assertSame('public_menu.literal', $menu->items()[1]['label']);
        $this->assertSame('it', app()->getLocale());
        $this->assertSame('it', app('translator')->getLocale());
    }

    public function test_switcher_preserves_configured_order_and_marks_the_selected_language(): void
    {
        $menu = (new FrontendMenu)->withLanguages(['en', 'it'], 'it', '/choose-language');
        $urls = ['it' => '/news/123', 'en' => '/en/news/123', 'es' => '/es/news/123'];
        $switcher = $menu->languageSwitcher($urls);

        $this->assertSame('/choose-language', $switcher['action']);
        $this->assertSame(['en', 'it'], array_column($switcher['items'], 'locale'));
        $this->assertSame([false, true], array_column($switcher['items'], 'active'));
        $this->assertSame(['/en/news/123', '/news/123'], array_column($switcher['items'], 'url'));
        $this->assertSame([], (new FrontendMenu)->languageSwitcher());
        $this->assertSame([], $menu->languageSwitcher(['it' => '/news/123']));
        $this->assertSame([], $menu->withLanguages(['it', 'it'], 'it', '/choose-language')->languageSwitcher($urls));
    }
}
