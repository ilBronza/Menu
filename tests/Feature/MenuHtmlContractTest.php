<?php

namespace IlBronza\Menu\Tests\Feature;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;
use IlBronza\Menu\Helpers\MenuPayloadBuilder;
use IlBronza\Menu\Tests\TestCase;

class MenuHtmlContractTest extends TestCase
{
    public function test_dropdown_columns_and_widths_follow_uikit_layout(): void
    {
        foreach ([1 => [1, 1, 1, 1, 1], 2 => [2, 2, 1]] as $perColumn => $expectedSizes) {
            $button = $this->menu()->createButton([
                'name' => 'columns-' . $perColumn, 'childrenPerColumn' => $perColumn,
                'children' => array_map(fn ($i) => ['name' => 'leaf-' . $i, 'href' => '/leaf-' . $i], range(1, 5)),
            ]);
            $html = $button->navbarRender('horizontal');
            $document = new DOMDocument();
            $document->loadHTML($html, LIBXML_NOERROR | LIBXML_NOWARNING);
            $xpath = new DOMXPath($document);
            $sizes = [];
            foreach ($xpath->query('//div[contains(@class, "uk-drop-grid")]/div/ul') as $column)
                $sizes[] = $xpath->query('./li', $column)->length;
            $this->assertSame($expectedSizes, $sizes);
            $this->assertStringContainsString('uk-navbar-dropdown-width-' . count($expectedSizes), $html);
            $this->assertStringNotContainsString('uk-width-auto', $html);
        }

        $button->setDropdownColumns(4);
        $html = $button->navbarRender('horizontal');
        $this->assertStringContainsString('uk-navbar-dropdown-width-4', $html);
        $document->loadHTML($html, LIBXML_NOERROR | LIBXML_NOWARNING);
        $sizes = [];
        foreach ((new DOMXPath($document))->query('//div[contains(@class, "uk-drop-grid")]/div/ul') as $column)
            $sizes[] = $column->getElementsByTagName('li')->length;
        $this->assertSame([2, 1, 1, 1], $sizes);
        $payload = (new MenuPayloadBuilder($this->menu()))->root();
        $item = $payload['navbars'][0]['items'][1];
        $this->assertSame(4, $item['fixedColumns']);
        $document->loadHTML($item['html']['desktop'], LIBXML_NOERROR | LIBXML_NOWARNING);
        $this->assertSame(4, (new DOMXPath($document))->query('//div[contains(@class, "uk-drop-grid")]/div/ul')->length);
        $button->dropdownWidth = '620px';
        $this->assertStringContainsString('width: 620px', $button->navbarRender('horizontal'));
        $button->dropdownWidth = null;
        $button->setDropdownColumns(6);
        $this->assertStringContainsString('width: 1200px', $button->navbarRender('horizontal'));
    }

    public function test_progressive_shells_preserve_the_existing_blade_structure(): void
    {
        config(['menu.logo.show' => true, 'menu.buttons.dropdownMode' => 'click']);
        $menu = $this->menu();
        $menu->provideNavbar()->setLogoByParameters([
            'href' => '/', 'path' => '/brand.svg', 'width' => '100px',
        ]);
        $rootButton = $menu->createButton([
            'name' => 'Clienti e ordini', 'text' => 'Clienti <strong>e ordini</strong>',
            'href' => '/clients', 'icon' => 'users', 'childrenPerColumn' => 2,
            'badge' => '<b>Novità</b>', 'count' => 3, 'classes' => ['project-link'],
            'children' => [
                [
                    'name' => 'active', 'text' => 'Active clients', 'href' => '/active',
                    'active' => true, 'childrenPerColumn' => 1,
                    'children' => [
                        ['name' => 'detail', 'text' => 'Detail', 'href' => '/detail'],
                        ['name' => 'second', 'text' => 'Second', 'href' => '/second'],
                        ['name' => 'third', 'text' => 'Third', 'href' => '/third'],
                    ],
                ],
                ['name' => 'leaf', 'text' => 'Leaf', 'href' => '/leaf', 'image' => '/leaf.png'],
                ['name' => 'preview', 'text' => 'Preview', 'href' => '/preview', 'lightbox' => true],
            ],
        ]);
        $menu->createButton([
            'name' => 'group', 'text' => 'Group',
            'children' => [['name' => 'group-leaf', 'text' => 'Group leaf', 'href' => '/group-leaf']],
        ]);
        $menu->provideNavbar('tools')->setPosition('right');
        $menu->provideNavbar('tools')->setBreakRow();
        $menu->provideNavbar('tools')->setClearfix();
        $menu->createButton(['navbar' => 'tools', 'name' => 'tool', 'text' => 'Tool', 'href' => '/tool']);
        $menu->provideNavbar('sections')->setOrientation('vertical');
        $menu->createButton(['navbar' => 'sections', 'name' => 'section', 'text' => 'Section', 'href' => '/section']);

        $builder = new MenuPayloadBuilder($menu);
        $payload = $builder->root();
        $branches = [];
        foreach ($menu->getNavbars()->values() as $index => $navbar)
            $this->assertShells($navbar->getButtons()->values()->all(), $payload['navbars'][$index]['items'], $builder, $branches);

        $first = $payload['navbars'][0]['items'][0];
        $this->assertStringContainsString('clienti-e-ordini', $first['html']['desktop']);
        $this->assertStringContainsString('uk-navbar-parent-icon', $first['html']['desktop']);
        $this->assertStringContainsString('uk-navbar-dropdown-width-2', $first['html']['desktop']);
        $this->assertStringContainsString('uk-drop-grid', $first['html']['desktop']);
        $this->assertStringNotContainsString('Active clients', $first['html']['desktop']);
        $this->assertStringNotContainsString('Active clients', $first['html']['sidebar']);
        $this->assertSame(2.0, $first['childrenColumnNumber']);

        // Optional bridge for the browser suite: expected HTML is rendered by
        // real Blade templates, rather than copied into a JavaScript fixture.
        if ($path = getenv('MENU_HTML_FIXTURE_PATH')) {
            $legacy = $menu->setProgressive(false)->render();
            $menu->setSticky(true)->setStickyOffset(24);
            $contracts = [
                ['payload' => $payload, 'branches' => $branches, 'legacyHtml' => $legacy],
                ['payload' => (new MenuPayloadBuilder($menu))->root(), 'branches' => $branches, 'legacyHtml' => $menu->render()],
            ];
            $menu->setSticky(false);
            $rootButton->dropdownWidth = '720px';
            $rootButton->getChildren()->first()->dropdownWidth = '360px';
            $customBuilder = new MenuPayloadBuilder($menu);
            $customPayload = $customBuilder->root();
            $customBranches = [];
            foreach ($menu->getNavbars()->values() as $index => $navbar)
                $this->assertShells($navbar->getButtons()->values()->all(), $customPayload['navbars'][$index]['items'], $customBuilder, $customBranches);
            $contracts[] = ['payload' => $customPayload, 'branches' => $customBranches, 'legacyHtml' => $menu->render()];
            file_put_contents($path, json_encode($contracts, JSON_THROW_ON_ERROR));
        }
    }

    private function assertShells(array $buttons, array $items, MenuPayloadBuilder $builder, array &$branches): void
    {
        foreach ($buttons as $index => $button) {
            $item = $items[$index];
            foreach (['desktop' => 'horizontal', 'sidebar' => 'vertical'] as $view => $orientation) {
                $legacyButton = clone $button;
                $this->assertSame(
                    $this->shape($legacyButton->navbarRender($orientation)),
                    $this->shape($item['html'][$view]),
                    $button->getName() . ': ' . $orientation,
                );
            }
            if ($item['hasChildren']) {
                $branch = $builder->children($item['id']);
                $branches[$item['childrenUrl']] = $branch;
                $this->assertShells($button->getChildren()->values()->all(), $branch['items'], $builder, $branches);
            }
        }
    }

    private function shape(string $html): array
    {
        $document = new DOMDocument();
        $document->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_NOERROR | LIBXML_NOWARNING);
        return $this->nodeShape($document->getElementsByTagName('li')->item(0), true);
    }

    private function nodeShape(DOMNode $node, bool $root = false): ?array
    {
        if ($node instanceof DOMElement) {
            // Descendants will only be delivered by their own branch response.
            if ($node->tagName === 'li' && ! $root)
                return null;
            $attributes = [];
            foreach ($node->attributes as $attribute) {
                if ($attribute->name === 'id')
                    continue;
                $value = $attribute->value;
                if ($attribute->name === 'class') {
                    $classes = array_unique(preg_split('/\s+/', trim($value), -1, PREG_SPLIT_NO_EMPTY));
                    sort($classes);
                    $value = implode(' ', $classes);
                }
                $attributes[$attribute->name] = $value;
            }
            ksort($attributes);
            $children = [];
            foreach ($node->childNodes as $child)
                if ($shape = $this->nodeShape($child))
                    $children[] = $shape;
            return [$node->tagName, $attributes, $children];
        }
        if ($node->nodeType === XML_TEXT_NODE && ($text = trim($node->textContent)))
            return ['text', $text];
        return null;
    }
}
