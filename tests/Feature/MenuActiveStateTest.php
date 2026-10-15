<?php

namespace IlBronza\Menu\Tests\Feature;

use DOMDocument;
use DOMXPath;
use IlBronza\Menu\Helpers\MenuPayloadBuilder;
use IlBronza\Menu\Tests\TestCase;
use Illuminate\Foundation\Auth\User;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as Routes;

class MenuActiveStateTest extends TestCase
{
    public function test_matching_links_mark_the_leaf_and_all_visible_ancestors(): void
    {
        $this->usePage('https://example.test/clients/42?tab=orders');
        $root = $this->menu()->createButton([
            'name' => 'work', 'children' => [[
                'name' => 'clients', 'children' => [
                    ['name' => 'detail', 'href' => '/clients/42#details'],
                    ['name' => 'other', 'href' => '/clients/43'],
                ],
            ]],
        ]);

        $builder = new MenuPayloadBuilder($this->menu());
        $payload = $builder->root();
        $parent = $payload['navbars'][0]['items'][0];
        $child = $builder->children($parent['id'])['items'][0];
        $leaf = $builder->children($child['id'])['items'][0];

        $this->assertTrue($leaf['active']);
        $this->assertArrayNotHasKey('active', $parent);
        $this->assertTrue($parent['containsActive']);
        $this->assertTrue($child['containsActive']);
        $this->assertSame([$leaf['id']], $payload['activeState']['items']);
        $this->assertEqualsCanonicalizing([$parent['id'], $child['id']], $payload['activeState']['ancestors']);
        $this->assertArrayNotHasKey('active', $builder->children($child['id'])['items'][1]);
        $this->assertTrue($root->containsActiveElement());
        $this->assertStringNotContainsString('/clients/42', json_encode($payload));
    }

    public function test_url_matching_is_exact_and_handles_local_relative_links(): void
    {
        $links = [
            '/clients/42', 'https://example.test/clients/42?tab=details',
            '//example.test/clients/42#details', './42/', '../clients/42',
            '/clients/4', '/clients', '/clients/42/edit',
            'https://other.test/clients/42', 'http://example.test/clients/42',
            'https://example.test:8443/clients/42', '#details', '?page=2',
            'javascript:void(0)', 'mailto:someone@example.test', '/clients/43',
        ];
        // Relative links resolve from the browser's current directory.
        $this->usePage('https://example.test/clients/42?page=2');
        foreach ($links as $index => $href)
            $this->menu()->createButton(['name' => 'link-' . $index, 'href' => $href]);

        $this->menu()->resolveActiveItems();

        foreach ($this->menu()->provideNavbar()->getAllButtons() as $index => $button)
            $this->assertSame($index < 5, $button->isActive(), $links[$index]);
    }

    public function test_named_route_urls_distinguish_resource_parameters(): void
    {
        Routes::get('/clients/{client}', fn () => $this->menu()->render())->name('clients.show');
        $this->menu()->createButton([
            'name' => 'first', 'routeName' => 'clients.show', 'routeParameters' => ['client' => 41],
        ]);
        $selected = $this->menu()->createButton([
            'name' => 'second', 'routeName' => 'clients.show', 'routeParameters' => ['client' => 42],
        ]);

        $this->get('/clients/42')->assertOk();

        $this->assertFalse($this->menu()->getButtonByName('first')->isActive());
        $this->assertTrue($selected->isActive());
    }

    public function test_explicit_route_patterns_cover_related_pages_and_override_url_matching(): void
    {
        $this->usePage('https://example.test/clients/42/edit', 'clients.edit');
        $selected = $this->menu()->createButton([
            'name' => 'clients', 'href' => '/clients', 'activeRoutes' => ['clients.*', 'orders.index'],
        ]);
        $other = $this->menu()->createButton([
            'name' => 'other', 'href' => '/clients/42/edit', 'activeRoutes' => 'orders.*',
        ]);

        $this->menu()->resolveActiveItems();

        $this->assertTrue($selected->isActive());
        $this->assertFalse($other->isActive());
    }

    public function test_manual_true_and_false_take_precedence_and_manual_descendants_propagate(): void
    {
        $this->usePage('https://example.test/current');
        $disabledAutomatic = $this->menu()->createButton(['name' => 'excluded', 'href' => '/current', 'active' => false]);
        $root = $this->menu()->createButton([
            'name' => 'manual', 'children' => [[
                'name' => 'nested', 'children' => [['name' => 'selected', 'href' => '/elsewhere', 'active' => true]],
            ]],
        ]);

        $this->menu()->resolveActiveItems();

        $this->assertFalse($disabledAutomatic->isActive());
        $this->assertTrue($root->containsActiveElement());
        $this->assertTrue($root->getChildren()->first()->containsActiveElement());
    }

    public function test_inaccessible_descendants_do_not_highlight_or_export_an_active_path(): void
    {
        $this->usePage('https://example.test/secret');
        $root = $this->menu()->createButton([
            'name' => 'public-root', 'children' => [
                ['name' => 'private', 'roles' => ['admin'], 'children' => [['name' => 'secret', 'href' => '/secret', 'active' => true]]],
                ['name' => 'public', 'href' => '/public'],
            ],
        ]);
        $payload = (new MenuPayloadBuilder($this->menu()))->root();

        $this->assertFalse($root->containsActiveElement());
        $this->assertSame(['items' => [], 'ancestors' => []], $payload['activeState']);
    }

    public function test_disabled_and_action_buttons_are_not_automatically_selected(): void
    {
        $this->usePage('https://example.test/current');
        foreach ([['disabled' => true], ['toggle' => '#modal'], ['ajax' => true], ['submit' => true]] as $index => $extra)
            $this->menu()->createButton(array_merge(['name' => 'action-' . $index, 'href' => '/current'], $extra));

        $this->menu()->resolveActiveItems();

        foreach ($this->menu()->provideNavbar()->getAllButtons() as $button)
            $this->assertFalse($button->isActive());
    }

    public function test_repeated_resolution_clears_automatic_state_and_preserves_manual_changes(): void
    {
        $this->usePage('https://example.test/first');
        $root = $this->menu()->createButton(['name' => 'root', 'children' => [['name' => 'leaf', 'href' => '/first']]]);
        $this->menu()->resolveActiveItems();
        $this->assertTrue($root->containsActiveElement());

        $this->usePage('https://example.test/second');
        $this->menu()->resolveActiveItems();
        $this->assertFalse($root->getChildren()->first()->isActive());
        $this->assertFalse($root->containsActiveElement());

        $root->getChildren()->first()->active = true;
        $this->menu()->resolveActiveItems();
        $this->assertTrue($root->containsActiveElement());
    }

    public function test_automatic_state_can_be_disabled_without_losing_manual_state(): void
    {
        $this->usePage('https://example.test/current');
        $automatic = $this->menu()->createButton(['name' => 'automatic', 'href' => '/current']);
        $manual = $this->menu()->createButton(['name' => 'manual', 'href' => '/other', 'active' => true]);
        $this->menu()->resolveActiveItems();
        $this->assertTrue($automatic->isActive());

        config(['menu.active.automatic' => false, 'menu.active.openMobilePath' => false]);
        $payload = (new MenuPayloadBuilder($this->menu()))->root();

        $this->assertFalse($automatic->isActive());
        $this->assertTrue($manual->isActive());
        $this->assertFalse($payload['options']['openMobilePath']);
    }

    public function test_legacy_desktop_and_offcanvas_highlight_the_full_path(): void
    {
        $this->usePage('https://example.test/current');
        $this->menu()->createButton([
            'name' => 'parent', 'text' => 'Parent', 'children' => [['name' => 'leaf', 'text' => 'Leaf', 'href' => '/current']],
        ]);
        $document = new DOMDocument();
        $document->loadHTML($this->menu()->setProgressive(false)->render(), LIBXML_NOERROR | LIBXML_NOWARNING);
        $xpath = new DOMXPath($document);

        $this->assertSame(4, $xpath->query('//li[contains(concat(" ", normalize-space(@class), " "), " uk-active ")]')->length);
        $this->assertSame(1, $xpath->query('//*[@data-ib-menu-offcanvas and @data-menu-open-active-path="true"]')->length);
    }

    public function test_branch_requests_cannot_replace_the_page_active_manifest(): void
    {
        $this->usePage('http://localhost/current');
        $this->menu()->createButton([
            'name' => 'parent', 'children' => [['name' => 'leaf', 'href' => '/current']],
        ]);
        $builder = new MenuPayloadBuilder($this->menu());
        $payload = $builder->root();
        $parent = $payload['navbars'][0]['items'][0];
        $leaf = $builder->children($parent['id'])['items'][0];
        $this->be((new User())->forceFill(['id' => 1]));

        $this->getJson($parent['childrenUrl'])->assertOk()->assertJsonPath('items.0.id', $leaf['id']);

        $this->assertSame([$leaf['id']], $payload['activeState']['items']);
        $this->assertSame([$parent['id']], $payload['activeState']['ancestors']);
        $this->assertFalse($this->menu()->getButtonByName('parent')->getChildren()->first()->isActive());
    }

    public function test_html_cache_is_separate_for_each_page(): void
    {
        config(['menu.usesCache' => true]);
        $menu = $this->menu();
        $menu->setUsesCache(true);
        $menu->createButton(['name' => 'first', 'text' => 'First', 'href' => '/first']);
        $menu->createButton(['name' => 'second', 'text' => 'Second', 'href' => '/second']);
        $this->usePage('http://localhost/first');
        $firstCache = $menu->getCacheName();
        $firstHtml = $menu->render();
        $this->usePage('http://localhost/second');
        $secondHtml = $menu->render();

        $this->assertNotSame($firstCache, $menu->getCacheName());
        $this->assertNotSame($firstHtml, $secondHtml);
        $this->assertTrue($menu->getButtonByName('second')->isActive());
        $this->assertFalse($menu->getButtonByName('first')->isActive());
    }

    public function test_whole_menu_fetch_preserves_the_original_named_route(): void
    {
        $dispatches = 0;
        Routes::get('/clients/{client}/edit', function () use (&$dispatches) {
            $dispatches++;
            return 'Original page';
        })->name('clients.edit');
        $this->menu()->setProgressive(true)->createButton([
            'name' => 'clients', 'href' => '/clients', 'activeRoutes' => 'clients.*',
        ]);
        $this->be((new User())->forceFill(['id' => 1]));

        $response = $this->get(route('ilBronza.menu.fetchMenu', ['menuPage' => 'http://localhost/clients/42/edit']));
        $response->assertOk();

        $this->assertTrue($this->menu()->getButtonByName('clients')->isActive());
        $this->assertSame(0, $dispatches);
    }

    public function test_whole_menu_fetch_ignores_external_page_context(): void
    {
        Routes::get('/clients/{client}/edit', fn () => '')->name('clients.edit');
        $this->menu()->setProgressive(true)->createButton([
            'name' => 'clients', 'href' => '/clients', 'activeRoutes' => 'clients.*',
        ]);
        $this->be((new User())->forceFill(['id' => 1]));

        $this->get(route('ilBronza.menu.fetchMenu', ['menuPage' => 'https://other.test/clients/42/edit']))->assertOk();

        $this->assertFalse($this->menu()->getButtonByName('clients')->isActive());
    }

    public function test_render_fetcher_carries_the_originating_page_url(): void
    {
        $this->usePage('http://localhost/current?tab=details');
        $this->app['view']->addNamespace('uikittemplate', dirname(__DIR__, 3) . '/UikitTemplate/resources/views');
        $document = new DOMDocument();
        $document->loadHTML($this->menu()->renderFetcher(), LIBXML_NOERROR | LIBXML_NOWARNING);
        $url = (new DOMXPath($document))->query('//*[@data-url]')->item(0)->getAttribute('data-url');
        parse_str(parse_url($url, PHP_URL_QUERY), $query);

        $this->assertSame('http://localhost/current', $query['menuPage']);
        $this->assertSame('true', $query['ibFetcher']);
    }

    private function usePage(string $url, ?string $name = null): void
    {
        $request = Request::create($url);
        if ($name !== null) {
            $route = (new Route('GET', $request->path(), fn () => ''))->name($name);
            $request->setRouteResolver(fn () => $route);
        }
        $this->app->instance('request', $request);
    }
}
