<?php

namespace IlBronza\Menu\Traits;

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

	public function getFromCache() : ?string
	{
		$menuName = $this->getCacheName();

		return cache($menuName);
	}

	public function renderFromCache() : string
	{
		if ($result = $this->getFromCache())
			return $result;

		$result = $this->_render();

		$cacheElementName = $this->getCacheName();

		cache([$cacheElementName => $result]);

		return $result;
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