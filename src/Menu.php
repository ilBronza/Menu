<?php

namespace IlBronza\Menu;

use App\Providers\Helpers\MenuItems;
use IlBronza\Buttons\Button;
use IlBronza\Menu\Navbar;
use IlBronza\Menu\Traits\MenuOffCanvasTrait;
use IlBronza\Menu\Traits\MenuRenderTrait;
use Illuminate\Support\Str;

class Menu
{
	use MenuOffCanvasTrait;
	use MenuRenderTrait;

	public $id;
	public $navbars;
	public $buttons;

	public $offCanvasButton;
	static $defaultNavbarName = 'default';

	public $usesSession;

	public function __construct()
	{
		$this->navbars = collect();
		$this->buttons = collect();
	}

    public function getId()
    {
        if($this->id)
            return $this->id;

        $this->setId(Str::random(8));

        return $this->id;
    }

    public function getContainerId()
    {
    	return "menu-container-{$this->getId()}";
    }

    public function setId(string $id)
    {
        $this->id = $id;
    }

	public function getNavbars()
	{
		return $this->navbars;
	}

	public function getDefaultNavbarName()
	{
		return static::$defaultNavbarName;
	}

	public function provideButton(array $parameters) : Button
	{
        if($button = $this->getButtonByName($parameters['name']))
        	return $button;

        return $this->createButton($parameters);
	}

	public function getButtonByName(string $name) : ? Button
	{
		foreach($this->getNavbars() as $navbar)
			if($button = $navbar->getButtonByName($name))
				return $button;

		return null;
	}

	public function createButton(array $parameters) : Button
	{
		$button = Button::create($parameters);

		$navbar = $this->provideNavbar(
			$parameters['navbar'] ?? $this->getDefaultNavbarName()
		);

		$button->addToNavbar($navbar);

		return $button;
	}

	public function getNavbarByName(string $name) : Navbar
	{
		if($navbar = $this->navbars->firstWhere('name', $name))
			return $navbar;

		$this->defaultNavbar = Navbar::create([
			'name' => $name,
			'sequence' => $this->getNavbarMaxSequence() + 1
		]);

		$this->navbars->push($this->defaultNavbar);

		return $this->defaultNavbar;
	}

	public function provideNavbar($navbar = null) : Navbar
	{
		if(! $navbar)
			$navbar = $this->getDefaultNavbarName();

		if(is_string($navbar))
			$navbar = $this->getNavbarByName($navbar);

		return $navbar;
	}

	public function getNavbarMaxSequence() : int
	{
		return $this->navbars->max('sequence') ?? 0;
	}

	public function moveItemToNavbar(Button $button, $navbar) : self
	{
		if(is_string($navbar))
			$navbar = $this->provideNavbar($navbar);

		$this->_moveItemToNavbar($button, $navbar);

		return $this;
	}

	public function _moveItemToNavbar(Button $button, Navbar $navbar)
	{
		$button->removeFromNavbar()
				->addToNavbar($navbar);
	}

	public function addToNavbar(Button $button, Navbar $navbar) : Button
	{
		$navbar->addButton($button);

		return $button;
	}

	public function getTemplateName()
	{
		return config('menu.template', 'uikit');
	}

	public function getViewName(string $type = 'horizontal')
	{
		$template = $this->getTemplateName();

		return 'menu::' . $template . '.' . $type;
	}

	public function hasClearfixNavbars() : bool
	{
		foreach($this->getNavbars() as $navbar)
			if($navbar->hasClearfix())
				return true;

		return false;
	}

	public function template()
	{
		return app(config('app.template', 'uikittemplate'));
	}

	public function getWrapClass() : ? string
	{
		if($this->hasClearfixNavbars())
			return $this->template()->getFlexWrapClass();

		return null;
	}

	public function getServiceProviders()
	{
		return config('menu.serviceProviders');
	}

	public function loadItemsFromProject()
	{
		MenuItems::loadProjectMenuItems();
	}

	public function loadItemsFromServiceProviders()
	{
		foreach($this->getServiceProviders() as $serviceProvider)
			app($serviceProvider)->manageMenuButtons();
	}
}