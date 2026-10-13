<?php

namespace IlBronza\Menu\Tests\Feature;

use DOMDocument;
use DOMXPath;
use IlBronza\Menu\Tests\Fixtures\TestMenu;
use IlBronza\Menu\Tests\TestCase;
use InvalidArgumentException;

class MenuRenderingTest extends TestCase
{
    public function test_progressive_render_embeds_only_roots_and_leaves_javascript_to_the_bundle(): void
    {
        config(['menu.progressive.enabled' => true]);
        $menu = $this->menu();
        $menu->createButton([
            'name' => 'customers',
            'text' => 'Customers root',
            'children' => [
                ['name' => 'invoices', 'text' => 'Invoices child', 'href' => '/invoices'],
            ],
        ]);

        $html = $menu->render();
        $payload = $this->payloadFromHtml($html);

        $this->assertSame('Customers root', $payload['navbars'][0]['items'][0]['text']);
        $this->assertTrue($payload['navbars'][0]['items'][0]['hasChildren']);
        $this->assertStringNotContainsString('Invoices child', $html);
        $this->assertStringNotContainsString('/invoices', $html);
        $this->assertSame(0, $this->xpath($html)->query('//script[@src or not(@type="application/json")]')->length);
        $this->assertSame('horizontal', $menu->getOrientation());
        $this->assertSame(1, $menu->providerLoads);
        $this->assertSame(1, $menu->projectLoads);
    }

    public function test_embedded_json_cannot_close_the_script_element(): void
    {
        config(['menu.progressive.enabled' => true]);
        $text = '</script><script id="injected">alert("menu")</script> & < >';
        $this->menu()->createButton(['name' => 'hostile-label', 'text' => $text]);

        $html = $this->menu()->render();
        $payload = $this->payloadFromHtml($html);

        $this->assertSame($text, $payload['navbars'][0]['items'][0]['text']);
        $this->assertStringNotContainsString('<script id="injected">', $html);
        $this->assertSame(0, $this->xpath($html)->query('//script[@id="injected"]')->length);
    }

    public function test_disabled_progressive_mode_keeps_complete_legacy_menu(): void
    {
        config(['menu.progressive.enabled' => false]);
        $menu = $this->menu();
        $menu->createButton([
            'name' => 'customers',
            'text' => 'Customers root',
            'children' => [
                ['name' => 'invoices', 'text' => 'Invoices child', 'href' => '/invoices'],
            ],
        ]);

        $html = $menu->render();
        $xpath = $this->xpath($html);

        $this->assertStringContainsString('Customers root', $html);
        $this->assertStringContainsString('Invoices child', $html);
        $this->assertStringNotContainsString('data-menu-payload', $html);
        $this->assertSame(1, $xpath->query('//*[@uk-offcanvas]')->length);
        $this->assertSame('horizontal', $menu->getOrientation());
        $this->assertSame(1, $menu->providerLoads);
        $this->assertSame(1, $menu->projectLoads);
    }

    public function test_instance_can_opt_in_to_progressive_rendering(): void
    {
        config(['menu.progressive.enabled' => false]);
        $this->menu()->setProgressive(true);

        $this->payloadFromHtml($this->menu()->render());
    }

    public function test_instance_can_opt_out_of_progressive_rendering(): void
    {
        config(['menu.progressive.enabled' => true]);
        $this->menu()->setProgressive(false);

        $this->assertStringNotContainsString('data-menu-payload', $this->menu()->render());
    }

    public function test_loading_then_rendering_both_menus_does_not_rebuild_items(): void
    {
        config(['menu.progressive.enabled' => false]);
        $menu = $this->menu();
        $menu->onProviderLoad = function (TestMenu $menu): void {
            $menu->createButton(['name' => 'provider-item', 'text' => 'Provider item']);
        };
        $menu->onProjectLoad = function (TestMenu $menu): void {
            $menu->createButton(['name' => 'project-item', 'text' => 'Project item']);
        };

        $menu->loadItems();
        $menu->loadItems();
        $menu->render();
        $menu->render();
        $menu->renderOffcanvas();

        $this->assertSame(1, $menu->providerLoads);
        $this->assertSame(1, $menu->projectLoads);
        $this->assertCount(2, $menu->provideNavbar()->getAllButtons());
        $this->assertSame('horizontal', $menu->getOrientation());
    }

    public function test_offcanvas_restores_the_original_orientation(): void
    {
        $menu = $this->menu()->setOrientation('vertical');

        $html = $menu->renderOffcanvas();

        $this->assertStringContainsString('uk-offcanvas', $html);
        $this->assertSame('vertical', $menu->getOrientation());
    }

    public function test_offcanvas_restores_orientation_when_view_rendering_fails(): void
    {
        $menu = $this->menu()->setViewFolder('missing-test-view');

        try {
            $menu->renderOffcanvas();
            $this->fail('Rendering an unknown offcanvas view must fail.');
        } catch (InvalidArgumentException $exception) {
            $this->assertStringContainsString('missing-test-view', $exception->getMessage());
        }

        $this->assertSame('horizontal', $menu->getOrientation());
    }

    public function test_progressive_render_ignores_cached_html_and_reflects_current_items(): void
    {
        config(['menu.progressive.enabled' => true]);
        $menu = $this->menu();
        $menu->setUsesCache(true);
        cache()->put($menu->getCacheName(), 'STALE MENU HTML', 60);
        $button = $menu->createButton(['name' => 'current', 'text' => 'Current item']);

        $firstPayload = $this->payloadFromHtml($menu->render());
        $button->setText('Updated item');
        $secondPayload = $this->payloadFromHtml($menu->render());

        $this->assertSame('Current item', $firstPayload['navbars'][0]['items'][0]['text']);
        $this->assertSame('Updated item', $secondPayload['navbars'][0]['items'][0]['text']);
        $this->assertSame(1, $menu->providerLoads);
        $this->assertSame(1, $menu->projectLoads);
    }

    public function test_vertical_orientation_keeps_the_existing_renderer(): void
    {
        config(['menu.progressive.enabled' => true]);
        $menu = $this->menu()->setOrientation('vertical');
        $menu->createButton(['name' => 'vertical-item', 'text' => 'Vertical item']);

        $html = $menu->render();

        $this->assertStringContainsString('Vertical item', $html);
        $this->assertStringContainsString('uk-nav-default', $html);
        $this->assertStringNotContainsString('data-menu-payload', $html);
        $this->assertSame('vertical', $menu->getOrientation());
    }

    public function test_custom_view_folder_is_not_replaced_by_progressive_renderer(): void
    {
        config(['menu.progressive.enabled' => true]);
        $this->app['view']->addNamespace('menu', __DIR__ . '/../Fixtures/views');
        $menu = $this->menu()->setViewFolder('custom');

        $html = $menu->render();

        $this->assertStringContainsString('Custom folder: horizontal', $html);
        $this->assertStringNotContainsString('data-menu-payload', $html);
    }

    public function test_custom_template_is_not_replaced_by_progressive_renderer(): void
    {
        config(['menu.progressive.enabled' => true, 'menu.template' => 'custom']);
        $this->app['view']->addNamespace('menu', __DIR__ . '/../Fixtures/views');

        $html = $this->menu()->render();

        $this->assertStringContainsString('Custom template: horizontal', $html);
        $this->assertStringNotContainsString('data-menu-payload', $html);
    }

    private function payloadFromHtml(string $html): array
    {
        $scripts = $this->xpath($html)->query(
            '//*[@data-ib-progressive-menu]//script[@type="application/json" and @data-menu-payload]'
        );
        $this->assertSame(1, $scripts->length, 'The menu must contain one JSON payload.');

        return json_decode($scripts->item(0)->textContent, true, 512, JSON_THROW_ON_ERROR);
    }

    private function xpath(string $html): DOMXPath
    {
        $document = new DOMDocument();
        $document->loadHTML($html, LIBXML_NOERROR | LIBXML_NOWARNING);

        return new DOMXPath($document);
    }
}
