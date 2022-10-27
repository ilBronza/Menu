<?php

namespace IlBronza\Menu;

use IlBronza\UikitTemplate\Traits\UseTemplateTrait;

class Logo
{
	use UseTemplateTrait;

	public $name = 'default';
	public $position = 'left';
	public $show;
	public $href;
	public $path;
	public $width;

	static function create(array $parameters)
	{
		$logo = new static();

		foreach($parameters as $name => $value)
			if(property_exists($logo, $name))
				$logo->$name = $value;
			else
				throw new \Exception('Property ' . $name . ' not set on Logo');

		return $logo;
	}

    public function getViewComponentName() : ? string
    {
        return 'menu';
    }

    public function getPath()
    {
    	return $this->path;
    }

    public function getHref()
    {
    	return $this->href;
    }

	public function getViewName(string $type = 'horizontal')
	{
		$template = $this->getTemplateName();

		mori('menu::' . $template . '.' . $type);

		return 'menu::' . $template . '.' . $type;
	}

	public function render(string $type = 'horizontal')
	{
        $viewName = $this->getTemplateViewName("logo.{$type}");

        return view($viewName, ['logo' => $this])->render();
	}

	public function getWidth()
	{
		return $this->width;
	}

	public function getWidthCssString() : ? string
	{
		if(! $width = $this->getWidth())
			return null;

		return "width: {$width};";
	}
}