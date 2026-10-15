<?php

namespace IlBronza\Menu\Helpers;

use IlBronza\Buttons\Button;
use IlBronza\CRUD\Helpers\UserRolesPermissionsHelpers\UserRolesPermissionsHelper;
use IlBronza\Menu\Menu;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use WeakMap;

/** Resolve page state before either the Blade or progressive menu is rendered. */
class MenuActiveStateResolver
{
    protected WeakMap $states;

    public function __construct()
    {
        $this->states = new WeakMap();
    }

    /** A deferred whole-menu render carries the URL of its originating page. */
    public static function pageRequest(Request $request) : Request
    {
        $page = $request->query('menuPage');
        if ($request->route()?->getName() !== 'ilBronza.menu.fetchMenu'
            || ! is_string($page) || ! preg_match('#^https?://#i', $page))
            return $request;

        try
        {
            $context = Request::create($page);
        }
        catch (InvalidArgumentException $exception)
        {
            return $request;
        }
        if ($context->getSchemeAndHttpHost() !== $request->getSchemeAndHttpHost())
            return $request;

        try
        {
            // Match metadata only: do not dispatch the original page or its middleware.
            $route = app('router')->getRoutes()->match($context);
        }
        catch (NotFoundHttpException | MethodNotAllowedHttpException $exception)
        {
            return $request;
        }
        $context->setRouteResolver(fn () => $route);

        return $context;
    }

    public function resolve(Menu $menu, Request $request) : void
    {
        foreach ($menu->getNavbars() as $navbar)
        {
            $this->restore($navbar->getAllButtons());
            $this->resolveButtons($navbar->getAllButtons(), $request);
        }
    }

    /** Restore only state assigned by us, preserving subsequent manual changes. */
    protected function restore(iterable $buttons) : void
    {
        foreach ($buttons as $button)
        {
            $previous = $this->states[$button] ?? null;
            if ($previous)
            {
                if ($button->active === $previous['resolvedActive'])
                    $button->active = $previous['active'];
                if ($button->containsActiveElement === $previous['resolvedContains'])
                    $button->containsActiveElement = $previous['contains'];
            }
            $this->states[$button] = [
                'active' => $button->active,
                'contains' => $button->containsActiveElement,
                'resolvedActive' => $button->active,
                'resolvedContains' => $button->containsActiveElement,
            ];
            $this->restore($button->getChildren());
        }
    }

    protected function resolveButtons(iterable $buttons, Request $request) : bool
    {
        $containsActive = false;
        foreach ($buttons as $button)
        {
            if (! UserRolesPermissionsHelper::hasValidItemRoles($button))
                continue;

            if ($button->active === null && config('menu.active.automatic', true) && $this->matches($button, $request))
                $button->active = true;

            if ($this->resolveButtons($button->getChildren(), $request))
                $button->containsActiveElement = true;

            $state = $this->states[$button];
            $state['resolvedActive'] = $button->active;
            $state['resolvedContains'] = $button->containsActiveElement;
            $this->states[$button] = $state;
            $containsActive = $containsActive || $button->isActive() || $button->containsActiveElement();
        }

        return $containsActive;
    }

    protected function matches(Button $button, Request $request) : bool
    {
        if ($button->isDisabled() || $button->getToggle() || $button->isAjax() || $button->isSubmit())
            return false;

        // Explicit patterns associate an index link with detail/edit routes too.
        if ($button->activeRoutes !== null)
        {
            $name = $request->route()?->getName();

            return $name !== null && Str::is((array) $button->activeRoutes, $name);
        }

        $href = trim((string) $button->getHref());
        if ($href === '' || $href[0] === '#' || preg_match('/[\x00-\x20\x7f\\\\]/', $href))
            return false;

        $url = parse_url($href);
        if ($url === false || isset($url['user']) || isset($url['pass']))
            return false;
        if (isset($url['scheme']) && ! in_array(strtolower($url['scheme']), ['http', 'https'], true))
            return false;
        if (isset($url['host']))
        {
            $scheme = strtolower($url['scheme'] ?? $request->getScheme());
            $port = $url['port'] ?? ($scheme === 'https' ? 443 : 80);
            if (strtolower($url['host']) !== strtolower($request->getHost())
                || $scheme !== $request->getScheme() || $port !== $request->getPort())
                return false;
        }

        $path = $url['path'] ?? '';
        if ($path === '')
            return false;
        if ($path[0] !== '/')
            $path = substr($request->getPathInfo(), 0, strrpos($request->getPathInfo(), '/') + 1) . $path;

        // Queries and fragments do not change which application page is active.
        return $this->normalizePath($path) === $this->normalizePath($request->getPathInfo());
    }

    protected function normalizePath(string $path) : string
    {
        $segments = [];
        foreach (explode('/', $path) as $segment)
        {
            if ($segment === '..')
                array_pop($segments);
            elseif ($segment !== '.')
                $segments[] = $segment;
        }

        return rtrim(implode('/', $segments), '/') ?: '/';
    }
}
