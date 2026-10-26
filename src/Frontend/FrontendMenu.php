<?php

namespace IlBronza\Menu\Frontend;

use LogicException;

/** Public menu state. Never resolves the legacy menu or its providers. */
final class FrontendMenu
{
    private array $items = [];
    private ?object $context = null;
    private bool $loading = false;

    public function __construct(private readonly array $configuration = []) {}

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
