<?php

namespace IlBronza\Menu\Frontend;

use LogicException;

/** Public menu state. Never resolves the legacy menu or its providers. */
final class FrontendMenu
{
    private array $items = [];
    private ?object $context = null;
    private bool $loading = false;
    private ?string $locale = null;
    private array $languages = [];
    private ?string $languageAction = null;

    public function __construct(private readonly array $configuration = []) {}

    /** Receive language state from the application, without managing its session. */
    public function withLanguages(array $languages, string $locale, string $action): self
    {
        if ($this->locale !== $locale || $this->languages !== $languages || $this->languageAction !== $action) {
            $this->context = null;
        }
        $this->languages = array_values(array_unique($languages));
        $this->locale = $locale;
        $this->languageAction = $action;

        return $this;
    }

    public function locale(): string
    {
        return $this->locale ?? app()->getLocale();
    }

    /** Translate a menu label without changing the application's translator locale. */
    public function translate(string $key, array $replace = []): string
    {
        $label = trans($key, $replace, $this->locale());

        if (! is_string($label)) {
            throw new LogicException('Frontend menu translation keys must resolve to strings.');
        }

        return $label;
    }

    public function addTranslated(string $key, string $url, array $children = [], bool $active = false, array $replace = []): self
    {
        return $this->add($this->translate($key, $replace), $url, $children, $active);
    }

    /** Destinations are supplied by the page/model; Menu never rewrites URLs. */
    public function languageSwitcher(array $urls = []): array
    {
        $languages = array_values(array_filter($this->languages, fn (string $locale) =>
            isset($urls[$locale]) && is_string($urls[$locale]) && $urls[$locale] !== ''
        ));

        if (count($languages) < 2 || $this->languageAction === null) {
            return [];
        }

        return [
            'action' => $this->languageAction,
            'items' => array_map(fn (string $locale) => [
                'locale' => $locale,
                'label' => strtoupper(str_replace('_', '-', $locale)),
                'active' => $locale === $this->locale(),
                'url' => $urls[$locale],
            ], $languages),
        ];
    }

    public function add(string $label, string $url, array $children = [], bool $active = false): self
    {
        if (! $this->loading) {
            throw new LogicException('Frontend items must be added by a menu provider.');
        }
        $this->items[] = compact('label', 'url', 'children', 'active');
        return $this;
    }

    public function build(object $context): self
    {
        if ($this->loading) {
            throw new LogicException('Recursive frontend menu loading.');
        }
        if ($this->context === $context) {
            return $this;
        }
        $this->items = [];
        $this->context = null;
        $this->loading = true;
        try {
            $providers = $this->configuration['providers'] ?? [];
            $project = $this->configuration['projectProvider'] ?? 'App\\Providers\\Helpers\\FrontendMenuItems';
            if ($project && class_exists($project)) {
                $providers[] = $project;
            }
            foreach (array_unique($providers) as $provider) {
                $instance = app($provider);
                if (! $instance instanceof FrontendMenuProvider) {
                    throw new LogicException($provider.' must implement '.FrontendMenuProvider::class);
                }
                $instance->build($this, $context);
            }
            $this->context = $context;
        } catch (\Throwable $exception) {
            $this->items = [];
            throw $exception;
        } finally {
            $this->loading = false;
        }
        return $this;
    }

    public function items(): array
    {
        return $this->items;
    }
}
