<?php

namespace IlBronza\Menu\Helpers;

use IlBronza\Buttons\Button;
use IlBronza\CRUD\Helpers\UserRolesPermissionsHelpers\UserRolesPermissionsHelper;
use IlBronza\Menu\Menu;
use IlBronza\Menu\Navbar;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Export one level at a time, sharing identifiers across the desktop and mobile menus.
 * A builder belongs to one request: personalized payloads must never be shared in cache.
 */
class MenuPayloadBuilder
{
    protected Menu $menu;
    protected array $nodes = [];
    protected array $navbars = [];
    protected bool $prepared = false;

    public function __construct(Menu $menu)
    {
        $this->menu = $menu;
    }

    public function root() : array
    {
        $this->prepare();

        $messages = [];
        foreach (['loading', 'retry', 'loadError', 'openMenu', 'closeMenu', 'expand'] as $key)
            $messages[$key] = trans('menu::menu.' . $key);

        $offcanvasButton = $this->menu->hasOffCanvas() ? clone $this->menu->getOffCanvasButton() : null;
        if ($offcanvasButton)
            $offcanvasButton->setId($this->menu->getContainerId() . '-toggle');

        return [
            'version' => 1,
            // Stable IDs retain the page context when branches use their own route.
            'activeState' => [
                'items' => array_keys(array_filter($this->nodes, fn (array $node) => $node['button']->isActive())),
                'ancestors' => array_keys(array_filter($this->nodes, fn (array $node) => $node['button']->containsActiveElement())),
            ],
            'navbars' => array_map(function (array $entry) {
                /** @var Navbar $navbar */
                $navbar = $entry['navbar'];
                $logo = $navbar->getLogo();

                return [
                    'id' => $entry['id'],
                    'name' => $navbar->getName(),
                    'orientation' => $navbar->getOrientation(),
                    'classes' => $this->classes($navbar->getHtmlClasses()),
                    'breakRow' => $navbar->mustBreakRow(),
                    'logo' => $logo ? [
                        'href' => $this->safeHref($logo->getHref()),
                        'path' => $logo->getPath(),
                        'width' => $logo->getWidth(),
                    ] : null,
                    'items' => $this->items($entry['children']),
                ];
            }, $this->navbars),
            'options' => [
                'fullWidth' => $this->menu->isFullWidth(),
                'wrapClass' => $this->menu->getWrapClass(),
                'sticky' => $this->menu->getSticky(),
                'stickyOffset' => $this->menu->getStickyOffset(),
                'offcanvas' => (bool) $this->menu->hasOffCanvas(),
                'showLogo' => $this->menu->showLogo(),
                'offcanvasId' => $this->menu->getContainerId(),
                'offcanvasButtonHtml' => $this->menu->hasOffCanvas()
                    ? $offcanvasButton->renderButton()
                    : null,
                'dropdownMode' => config('menu.buttons.dropdownMode', 'hover'),
                'openMobilePath' => (bool) config('menu.active.openMobilePath', true),
            ],
            'messages' => $messages,
        ];
    }

    public function children(string $id) : array
    {
        $this->prepare();

        if (empty($this->nodes[$id]['children']))
            throw new NotFoundHttpException();

        return ['id' => $id, 'items' => $this->items($this->nodes[$id]['children'])];
    }

    protected function prepare() : void
    {
        if ($this->prepared)
            return;

        $this->menu->resolveActiveItems();
        $occurrences = [];

        foreach ($this->menu->getNavbars() as $navbar)
        {
            $name = (string) $navbar->getName();
            $occurrence = $occurrences[$name] ?? 0;
            $occurrences[$name] = $occurrence + 1;
            $path = [['navbar', $name, $occurrence]];

            $this->navbars[] = [
                'id' => $this->identifier($path),
                'navbar' => $navbar,
                // Count duplicate names before authorization filtering so identifiers
                // cannot accidentally address another node after a role change.
                'children' => $this->index($navbar->getAllButtons()->sortBy('position'), $path),
            ];
        }

        $this->prepared = true;
    }

    protected function index(iterable $buttons, array $parentPath) : array
    {
        $result = [];
        $occurrences = [];

        foreach ($buttons as $button)
        {
            $name = (string) $button->getName();
            $occurrence = $occurrences[$name] ?? 0;
            $occurrences[$name] = $occurrence + 1;

            // Match Button::renderType(), including its super-admin behavior.
            // Do not index descendants of an inaccessible ancestor, even if the
            // descendant has no roles of its own and its identifier is known.
            if (! UserRolesPermissionsHelper::hasValidItemRoles($button))
                continue;

            $path = array_merge($parentPath, [[$name, $occurrence]]);
            $children = $this->index($button->getChildren(), $path);

            if ($button->hasChildren() && ! $children && ! $this->hasAction($button))
                continue;

            $id = $this->identifier($path);
            $this->nodes[$id] = ['button' => $button, 'children' => $children];
            $result[] = $id;
        }

        return $result;
    }

    protected function hasAction(Button $button) : bool
    {
        return $this->safeHref($button->getHref()) !== null
            || (bool) $button->getToggle()
            || $button->isAjax()
            || $button->isSubmit();
    }

    protected function identifier(array $path) : string
    {
        return 'm-' . hash('sha256', json_encode($path, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
    }

    protected function items(array $ids) : array
    {
        return array_map(fn (string $id) => $this->item($id), $ids);
    }

    protected function item(string $id) : array
    {
        $node = $this->nodes[$id];
        /** @var Button $button */
        $button = $node['button'];
        $hasChildren = count($node['children']) > 0;

        // Some Button getters append classes on every call. Clone before using
        // them, preserving subclasses without modifying the registered menu.
        $displayButton = clone $button;
        $classes = $this->classes($displayButton->getHtmlClassesString());
        $icon = $button->hasFaIcon() ? $button->getIcon() : null;

        $item = [
            'id' => $id,
            'name' => $button->getName(),
            // Existing Blade templates intentionally render these strings as HTML.
            'text' => $button->getText(),
            'href' => $this->safeHref($button->getHref()),
            'hasChildren' => $hasChildren,
        ];

        $optional = [
            'icon' => $icon ? [
                'code' => $icon->getCode(),
                'filling' => $icon->getFillingType(),
                'classes' => array_values(array_unique($icon->getHtmlClasses())),
            ] : null,
            'image' => $button->image,
            'target' => $button->getTarget(),
            'classes' => $classes,
            'data' => $button->getData(),
            'badge' => $button->hasBadge() ? $button->getBadgeHtml() : null,
            'count' => $button->getCount(),
            'active' => $button->isActive(),
            'containsActive' => $button->containsActiveElement(),
            'disabled' => $button->isDisabled(),
            'confirm' => $button->hasReturnConfirm() ? $button->getReturnConfirmText() : null,
            'toggle' => $button->getToggle(),
            'iframe' => $button->isIframe(),
            'lightbox' => $button->hasLightbox(),
        ];

        foreach ($optional as $key => $value)
            if ($value !== null && $value !== false && $value !== '' && $value !== [])
                $item[$key] = $value;

        if ($hasChildren)
        {
            $item['childrenUrl'] = route('ilBronza.menu.items', ['id' => $id]);
            $item['childrenPerColumn'] = max(1, (int) $button->getChildrenPerColumn());
            if ($button->dropdownMode && $button->dropdownMode !== config('menu.buttons.dropdownMode', 'hover'))
                $item['dropdownMode'] = $button->dropdownMode;

            // Width calculation must count only visible children.
            $displayButton->children = collect(array_map(
                fn (string $childId) => $this->nodes[$childId]['button'],
                $node['children']
            ));
            $displayButton->childrenPerColumn = $item['childrenPerColumn'];
            $item['childrenColumnNumber'] = $displayButton->getChildrenColumnNumber();
            if ($width = $displayButton->getDropdownWidth())
                $item['dropdownWidth'] = $width;
        }

        // Render the very same Button views as the traditional menu. Empty
        // placeholders retain parent icons, columns and widths, while keeping
        // descendant labels and links out of this response.
        $displayButton->children = collect(array_fill(0, count($node['children']), new DeferredMenuButton([])));
        $displayButton->setId($id);
        $item['html'] = [
            'desktop' => $displayButton->navbarRender('horizontal'),
            'sidebar' => $displayButton->navbarRender('vertical'),
        ];

        return $item;
    }

    protected function classes(string $classes) : string
    {
        return implode(' ', array_values(array_unique(preg_split('/\s+/', trim($classes), -1, PREG_SPLIT_NO_EMPTY))));
    }

    protected function safeHref(?string $href) : ?string
    {
        if ($href === null || trim($href) === '')
            return null;

        // Strip characters browsers ignore when recognizing a URL scheme.
        $scheme = preg_replace('/[\x00-\x20\x7f]+/', '', $href);
        if (preg_match('/^(javascript|vbscript|data):/i', $scheme))
            return null;

        return $href;
    }
}
