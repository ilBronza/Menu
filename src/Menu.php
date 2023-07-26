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
	public $defaultNavbar;
	static $defaultNavbarName = 'default';

	public $usesCache;

	public function __construct()
	{
		$this->navbars = collect();
		$this->buttons = collect();

		$this->manageLogo();
	}

	public function showLogo()
	{
		return config('menu.logo.show', true);
	}

	public function manageLogo()
	{
		$navbar = $this->provideNavbar(
			$this->getDefaultNavbarName()
		);

		$navbar->setLogoByParameters(config('menu.logo'));
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

		$button->setDropdownMode(
			$parameters['dropdownMode'] ?? config('menu.buttons.dropdownMode', 'hover')
		);

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

	public function provideMainRightBar()
	{
		$nav = $this->getNavbarByName('mainRightNavbar');
		$nav->setPosition('right');

		return $nav;
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
		if($currentNavbar = $button->getNavbar())
			$currentNavbar->removeButton($button);

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
		{
			try
			{
				app($serviceProvider)->manageMenuButtons();
			}
			catch(\Exception $e)
			{
				throw new \Exception("Add {$serviceProvider} to the project or remove it from menu configurations: " . $e->getMessage());
			}
		}
	}
}