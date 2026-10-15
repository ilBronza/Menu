<?php

namespace IlBronza\Menu\Tests\Feature;

use IlBronza\Menu\Helpers\MenuPayloadBuilder;
use IlBronza\Menu\Tests\TestCase;
use Illuminate\Foundation\Auth\User;
use Illuminate\Http\Request;

class MenuBrowserCacheTest extends TestCase
{
    public function test_browser_cache_is_scoped_and_can_be_disabled(): void
    {
        $this->assertSame(['enabled' => false], $this->payload()['browserCache']);
        $this->be(new BrowserCacheUser(1));
        $settings = $this->payload()['browserCache'];
        $this->assertTrue($settings['enabled']);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $settings['key']);
        $this->assertSame(300, $settings['ttlSeconds']);
        $this->assertSame(50, $settings['maxEntries']);

        config(['menu.browserCache.enabled' => false]);
        $this->assertSame(['enabled' => false], $this->payload()['browserCache']);
        config(['menu.browserCache.enabled' => true, 'menu.browserCache.ttlSeconds' => 0]);
        $this->assertSame(['enabled' => false], $this->payload()['browserCache']);
    }

    public function test_scope_changes_with_user_locale_session_context_and_version(): void
    {
        $this->be(new BrowserCacheUser(1));
        $keys = [$this->payload()['browserCache']['key']];
        $this->be(new BrowserCacheUser(2));
        $keys[] = $this->payload()['browserCache']['key'];
        app()->setLocale('en');
        $keys[] = $this->payload()['browserCache']['key'];
        config(['menu.browserCache.context' => fn () => 'tenant-42']);
        $keys[] = $this->payload()['browserCache']['key'];
        config(['menu.browserCache.version' => '2']);
        $keys[] = $this->payload()['browserCache']['key'];
        $session = app('session.store');
        $session->setId(str_repeat('a', 40));
        request()->setLaravelSession($session);
        $keys[] = $this->payload()['browserCache']['key'];
        $session->setId(str_repeat('b', 40));
        $keys[] = $this->payload()['browserCache']['key'];

        $this->assertCount(7, array_unique($keys));
    }

    public function test_page_highlighting_and_random_html_ids_do_not_invalidate_cached_branches(): void
    {
        $this->be(new BrowserCacheUser(1));
        $root = $this->menu()->createButton(['name' => 'root', 'children' => [
            ['name' => 'first', 'href' => '/first'], ['name' => 'second', 'href' => '/second'],
        ]]);
        $this->app->instance('request', Request::create('http://localhost/first'));
        $first = $this->payload();
        $root->setId('different-root-html-id');
        foreach ($root->getChildren() as $index => $child)
            $child->setId('different-child-html-id-' . $index);
        $this->app->instance('request', Request::create('http://localhost/second'));
        $second = $this->payload();

        $this->assertNotSame($first['activeState'], $second['activeState']);
        $this->assertSame($first['browserCache'], $second['browserCache']);
        $this->assertSame($first['navbars'][0]['items'][0]['childrenCacheKey'], $second['navbars'][0]['items'][0]['childrenCacheKey']);
    }

    public function test_visible_content_changes_invalidate_ancestors_without_rendering_descendants(): void
    {
        $this->be(new BrowserCacheUser(1));
        $root = $this->menu()->createButton(['name' => 'root', 'children' => [[
            'name' => 'nested', 'children' => [['name' => 'leaf', 'text' => 'Original leaf', 'href' => '/leaf', 'count' => 1]],
        ]]]);
        $first = $this->payload()['navbars'][0]['items'][0]['childrenCacheKey'];
        $leaf = $root->getChildren()->first()->getChildren()->first();
        $leaf->setCount(2);
        $second = $this->payload()['navbars'][0]['items'][0]['childrenCacheKey'];
        $leaf->setText('Updated leaf');
        $third = $this->payload()['navbars'][0]['items'][0]['childrenCacheKey'];
        $leaf->setHref('/updated');
        $payload = $this->payload();
        $fourth = $payload['navbars'][0]['items'][0]['childrenCacheKey'];

        $this->assertCount(4, array_unique([$first, $second, $third, $fourth]));
        $this->assertStringNotContainsString('Updated leaf', json_encode($payload));
        $this->assertStringNotContainsString('/updated', json_encode($payload));
    }

    public function test_permission_changes_invalidate_a_branch_for_the_same_user(): void
    {
        $this->menu()->createButton(['name' => 'root', 'children' => [
            ['name' => 'private', 'href' => '/private', 'roles' => ['admin']],
            ['name' => 'public', 'href' => '/public'],
        ]]);
        $this->be(new BrowserCacheUser(1, ['admin']));
        $first = $this->payload();
        $this->be(new BrowserCacheUser(1, ['editor']));
        $second = $this->payload();

        $this->assertSame($first['browserCache'], $second['browserCache']);
        $this->assertNotSame($first['navbars'][0]['items'][0]['childrenCacheKey'], $second['navbars'][0]['items'][0]['childrenCacheKey']);
        $this->assertSame($first['navbars'][0]['items'][0]['id'], $second['navbars'][0]['items'][0]['id']);
    }

    public function test_dropdown_mode_changes_invalidate_the_stored_html(): void
    {
        $root = $this->menu()->createButton(['name' => 'root', 'children' => [[
            'name' => 'nested', 'dropdownMode' => 'hover', 'children' => [['name' => 'leaf', 'href' => '/leaf']],
        ]]]);
        config(['menu.buttons.dropdownMode' => 'hover']);
        $first = $this->payload()['navbars'][0]['items'][0]['childrenCacheKey'];
        $root->getChildren()->first()->setDropdownMode('click');
        config(['menu.buttons.dropdownMode' => 'click']);
        $second = $this->payload()['navbars'][0]['items'][0]['childrenCacheKey'];

        $this->assertNotSame($first, $second);
    }

    private function payload(): array
    {
        return (new MenuPayloadBuilder($this->menu()))->root();
    }
}

class BrowserCacheUser extends User
{
    protected $guarded = [];
    public array $userRoles;

    public function __construct(int $id = 1, array $roles = [])
    {
        parent::__construct(['id' => $id]);
        $this->userRoles = $roles;
    }

    public function isSuperAdmin(): bool
    {
        return false;
    }

    public function hasAnyRole(array $roles): bool
    {
        return (bool) array_intersect($roles, $this->userRoles);
    }
}
