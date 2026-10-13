<?php

namespace IlBronza\Menu\Tests\Feature;

use IlBronza\Buttons\Button;
use IlBronza\Menu\Helpers\MenuPayloadBuilder;
use IlBronza\Menu\Tests\TestCase;
use Illuminate\Foundation\Auth\User;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class MenuPayloadTest extends TestCase
{
    public function test_multiple_navbars_preserve_layout_logo_and_explicit_dropdown_mode() : void
    {
        config(['menu.logo.show' => true, 'menu.isFullWidth' => false, 'menu.buttons.dropdownMode' => 'hover']);
        $menu = $this->menu()->setSticky(true)->setStickyOffset(24);
        $menu->provideNavbar()->setLogoByParameters([
            'href' => '/', 'path' => '/brand.svg', 'width' => '100px',
        ]);
        $menu->createButton([
            'name' => 'default-mode',
            'children' => [['name' => 'default-leaf', 'href' => '/default']],
        ]);
        $tools = $menu->provideNavbar('tools');
        $tools->setPosition('right');
        $tools->setClearfix();
        $tools->setBreakRow();
        $tools->setSmall();
        $menu->createButton([
            'name' => 'tools-menu', 'navbar' => 'tools', 'dropdownMode' => 'click',
            'children' => [[
                'name' => 'nested-tools', 'dropdownMode' => 'click',
                'children' => [['name' => 'tool', 'href' => '/tool']],
            ]],
        ]);
        $menu->provideNavbar('sections')->setOrientation('vertical');
        $menu->createButton(['name' => 'section-link', 'navbar' => 'sections', 'href' => '/sections']);

        $builder = new MenuPayloadBuilder($menu);
        $payload = $builder->root();

        $this->assertSame(['default', 'tools', 'sections'], array_column($payload['navbars'], 'name'));
        $this->assertSame(['horizontal', 'horizontal', 'vertical'], array_column($payload['navbars'], 'orientation'));
        $this->assertSame(['href' => '/', 'path' => '/brand.svg', 'width' => '100px'], $payload['navbars'][0]['logo']);
        $this->assertFalse($payload['navbars'][0]['breakRow']);
        $this->assertSame('uk-navbar-right uk-width-1-1 ib-navbar-small', $payload['navbars'][1]['classes']);
        $this->assertTrue($payload['navbars'][1]['breakRow']);
        $this->assertNull($payload['navbars'][1]['logo']);
        $this->assertSame('section-link', $payload['navbars'][2]['items'][0]['name']);
        $this->assertFalse($payload['options']['fullWidth']);
        $this->assertSame('uk-flex uk-flex-wrap', $payload['options']['wrapClass']);
        $this->assertTrue($payload['options']['sticky']);
        $this->assertSame(24, $payload['options']['stickyOffset']);
        $this->assertSame('hover', $payload['options']['dropdownMode']);
        $this->assertArrayNotHasKey('dropdownMode', $payload['navbars'][0]['items'][0]);
        $toolsItem = $payload['navbars'][1]['items'][0];
        $this->assertSame('click', $toolsItem['dropdownMode']);
        $this->assertSame('click', $builder->children($toolsItem['id'])['items'][0]['dropdownMode']);
    }

    public function test_root_and_children_export_only_one_level() : void
    {
        $this->menu()->createButton([
            'name' => 'customers', 'text' => 'Customers',
            'children' => [[
                'name' => 'active', 'text' => 'Active customers',
                'children' => [['name' => 'detail', 'text' => 'Customer detail', 'href' => '/customer/1']],
            ]],
        ]);

        $builder = new MenuPayloadBuilder($this->menu());
        $root = $builder->root();
        $item = $root['navbars'][0]['items'][0];

        $this->assertSame(1, $root['version']);
        $this->assertSame('Customers', $item['text']);
        $this->assertTrue($item['hasChildren']);
        $this->assertNull($item['href']);
        $this->assertArrayNotHasKey('children', $item);
        $this->assertStringNotContainsString('Active customers', json_encode($root));
        $this->assertStringNotContainsString('Customer detail', json_encode($root));

        $branch = $builder->children($item['id']);
        $this->assertSame($item['id'], $branch['id']);
        $this->assertCount(1, $branch['items']);
        $this->assertSame('Active customers', $branch['items'][0]['text']);
        $this->assertStringNotContainsString('Customer detail', json_encode($branch));
        $this->assertSame('Customer detail', $builder->children($branch['items'][0]['id'])['items'][0]['text']);
    }

    public function test_identifiers_are_stable_and_distinguish_duplicate_names() : void
    {
        foreach (['first', 'second'] as $navbarName)
        {
            $navbar = $this->menu()->provideNavbar($navbarName);
            foreach ([1, 2] as $duplicate)
                $navbar->addButton(Button::create([
                    'name' => 'same', 'id' => 'random-' . rand(),
                    'children' => [['name' => 'same', 'href' => '/leaf']],
                ]));
        }

        $builder = new MenuPayloadBuilder($this->menu());
        $first = $builder->root();
        foreach ($this->menu()->getNavbars() as $navbar)
            foreach ($navbar->getAllButtons() as $button)
                $button->setId('different-' . rand());
        $second = (new MenuPayloadBuilder($this->menu()))->root();
        $this->assertSame($first, $second);

        $ids = [];
        foreach ($first['navbars'] as $navbar)
            foreach ($navbar['items'] as $item)
            {
                $ids[] = $item['id'];
                $ids[] = $builder->children($item['id'])['items'][0]['id'];
            }
        $this->assertCount(8, array_unique($ids));
    }

    public function test_hidden_ancestor_protects_descendants_even_with_known_identifiers() : void
    {
        $this->menu()->createButton([
            'name' => 'private', 'roles' => ['admin'],
            'children' => [[
                'name' => 'unrestricted-child',
                'children' => [['name' => 'secret', 'href' => '/secret']],
            ]],
        ]);
        $this->be(new PayloadUser(['admin']));
        $privileged = new MenuPayloadBuilder($this->menu());
        $parent = $privileged->root()['navbars'][0]['items'][0];
        $child = $privileged->children($parent['id'])['items'][0];

        $this->be(new PayloadUser(['editor']));
        $this->assertSame([], (new MenuPayloadBuilder($this->menu()))->root()['navbars'][0]['items']);
        $this->getJson($parent['childrenUrl'])->assertNotFound();
        $this->getJson($child['childrenUrl'])->assertNotFound();
    }

    public function test_filters_restricted_children_and_prunes_empty_groups() : void
    {
        $this->be(new PayloadUser(['editor']));
        $this->menu()->createButton([
            'name' => 'empty',
            'children' => [['name' => 'secret', 'href' => '/secret', 'roles' => ['admin']]],
        ]);
        $this->menu()->createButton([
            'name' => 'accessible', 'href' => '/accessible',
            'children' => [['name' => 'secret', 'href' => '/secret', 'roles' => ['admin']]],
        ]);
        $this->menu()->createButton([
            'name' => 'mixed',
            'children' => [
                ['name' => 'secret', 'href' => '/secret', 'roles' => ['admin']],
                ['name' => 'public', 'href' => '/public'],
            ],
        ]);

        $builder = new MenuPayloadBuilder($this->menu());
        $items = $builder->root()['navbars'][0]['items'];
        $this->assertSame(['accessible', 'mixed'], array_column($items, 'name'));
        $this->assertFalse($items[0]['hasChildren']);
        $this->assertArrayNotHasKey('childrenUrl', $items[0]);
        $this->assertSame(['public'], array_column($builder->children($items[1]['id'])['items'], 'name'));
    }

    public function test_identifiers_do_not_shift_when_authorization_changes() : void
    {
        $navbar = $this->menu()->provideNavbar();
        $navbar->addButton(Button::create(['name' => 'same', 'roles' => ['admin'], 'href' => '/private']));
        $navbar->addButton(Button::create(['name' => 'same', 'href' => '/public']));
        $this->be(new PayloadUser(['admin']));
        $privilegedItems = (new MenuPayloadBuilder($this->menu()))->root()['navbars'][0]['items'];
        $this->be(new PayloadUser(['editor']));
        $items = (new MenuPayloadBuilder($this->menu()))->root()['navbars'][0]['items'];

        $this->assertSame($privilegedItems[1]['id'], $items[0]['id']);
    }

    public function test_super_admin_follows_existing_button_role_semantics() : void
    {
        $user = new PayloadUser();
        $user->superAdmin = true;
        $this->be($user);
        $this->menu()->createButton(['name' => 'admin', 'roles' => ['admin'], 'href' => '/admin']);

        $this->assertCount(1, (new MenuPayloadBuilder($this->menu()))->root()['navbars'][0]['items']);
    }

    public function test_action_metadata_is_preserved_without_mutating_button_classes() : void
    {
        $button = $this->menu()->createButton([
            'name' => 'export', 'text' => '<strong>Export</strong>', 'href' => '/export',
            'icon' => 'file', 'image' => '/icon.png', 'target' => '_blank',
            'classes' => ['custom', 'custom'], 'data' => ['route' => '/export', 'parameters' => ['format' => 'pdf']],
            'badge' => '<em>New</em>', 'count' => 4, 'active' => true,
            'containsActiveElement' => true, 'disabled' => true, 'iframe' => true, 'lightbox' => true,
            'returnConfirm' => true, 'returnConfirmText' => 'Continue?', 'toggle' => '#export',
        ]);
        $originalClasses = $button->classes;
        $builder = new MenuPayloadBuilder($this->menu());
        $item = $builder->root()['navbars'][0]['items'][0];

        $this->assertSame('<strong>Export</strong>', $item['text']);
        $this->assertSame('<em>New</em>', $item['badge']);
        $this->assertSame(['code' => 'file', 'filling' => 'solid', 'classes' => []], $item['icon']);
        $this->assertSame('custom export', $item['classes']);
        $this->assertSame($button->data, $item['data']);
        $this->assertSame('/icon.png', $item['image']);
        $this->assertSame('_blank', $item['target']);
        $this->assertSame('Continue?', $item['confirm']);
        $this->assertSame('#export', $item['toggle']);
        $this->assertSame(4, $item['count']);
        foreach (['active', 'containsActive', 'disabled', 'iframe', 'lightbox'] as $flag)
            $this->assertTrue($item[$flag]);
        $this->assertSame($item, $builder->root()['navbars'][0]['items'][0]);
        $this->assertSame($originalClasses, $button->classes);
    }

    public function test_placeholder_and_executable_urls_are_not_exported_as_links() : void
    {
        foreach (['javascript:void(0)', 'javascript:alert(1)', "java\nscript:alert(1)", 'data:text/html,hello'] as $index => $url)
            $this->menu()->createButton(['name' => 'item-' . $index, 'href' => $url]);

        foreach ((new MenuPayloadBuilder($this->menu()))->root()['navbars'][0]['items'] as $item)
            $this->assertNull($item['href']);
    }

    public function test_json_route_requires_authentication_and_does_not_cache_personalized_data() : void
    {
        $this->menu()->createButton(['name' => 'branch', 'children' => [['name' => 'leaf', 'href' => '/leaf']]]);
        $item = (new MenuPayloadBuilder($this->menu()))->root()['navbars'][0]['items'][0];
        $this->getJson($item['childrenUrl'])->assertUnauthorized();

        $this->be(new PayloadUser());
        $response = $this->getJson($item['childrenUrl']);
        $response->assertOk()->assertJsonPath('id', $item['id'])->assertJsonPath('items.0.name', 'leaf');
        $this->assertStringContainsString('private', $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->getJson(route('ilBronza.menu.items', ['id' => $response->json('items.0.id')]))->assertNotFound();
        $this->getJson(route('ilBronza.menu.items', ['id' => 'm-' . str_repeat('0', 64)]))->assertNotFound();
    }

    public function test_builder_rejects_a_leaf_identifier() : void
    {
        $this->menu()->createButton(['name' => 'leaf', 'href' => '/leaf']);
        $builder = new MenuPayloadBuilder($this->menu());
        $leaf = $builder->root()['navbars'][0]['items'][0];

        $this->expectException(NotFoundHttpException::class);
        $builder->children($leaf['id']);
    }
}

class PayloadUser extends User
{
    protected $guarded = [];
    public array $userRoles;
    public bool $superAdmin = false;

    public function __construct(array $roles = [])
    {
        parent::__construct(['id' => 1]);
        $this->userRoles = $roles;
    }

    public function isSuperAdmin() : bool
    {
        return $this->superAdmin;
    }

    public function hasAnyRole(array $roles) : bool
    {
        return count(array_intersect($this->userRoles, $roles)) > 0;
    }
}
