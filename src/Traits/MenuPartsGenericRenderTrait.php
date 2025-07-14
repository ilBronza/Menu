<?php

namespace IlBronza\Menu\Traits;

use function dd;

trait MenuPartsGenericRenderTrait
{
	public ?string $viewFolder = null;

	abstract public function getCacheName() : string;

	public function getOrientation() : string
	{
		return $this->orientation;
	}

	public function setOrientation(string $orientation) : self
	{
		$this->orientation = $orientation;

		return $this;
	}

	public function getCacheLifetimeSeconds() : int
	{
		return config('menu.cacheLifetimeSeconds', 60 * 10);
	}

	public function getFromCache() : ?string
	{
		$menuName = $this->getCacheName();

		return cache($menuName);
	}

	public function renderFromCache() : string
	{
			return cache()->remember(
				$this->getCacheName(),
				$this->getCacheLifetimeSeconds(),
				function()
				{
					return $this->_render();
				});

		// $result = $this->_render();

		// $cacheElementName = $this->getCacheName();

		// cache()->put($cacheElementName, $result);

		// return $result;
	}

	public function setUsesCache(bool $usesCache)
	{
		$this->usesCache = $usesCache;
	}

	public function usesCache()
	{
		if (is_null($this->usesCache))
			return config('menu.usesCache');

		return $this->usesCache;
	}

	public function render()
	{
		if ($this->usesCache())
			return $this->renderFromCache();

		return $this->_render();
	}

	public function getTemplateName()
	{
		return config('menu.template', 'uikit');
	}

	public function getElementType() : string
	{
		return strtolower(class_basename($this));
	}

	public function getViewFolder() : string
	{
		if ($this->viewFolder)
			return $this->viewFolder;

		return strtolower(class_basename($this));
	}

	public function setViewFolder(string $viewFolder) : self
	{
		$this->viewFolder = $viewFolder;

		return $this;
	}

	public function getViewName()
	{
		$template = $this->getTemplateName();

		$folder = $this->getViewFolder();

		$folders = implode(".", [
			$template,
			$folder,
			$this->getOrientation()
		]);

		return 'menu::' . $folders;
	}

	public function _render()
	{
		$viewName = $this->getViewName();
		$elementType = $this->getElementType();

		return view($viewName, [$elementType => $this])->render();
	}
}