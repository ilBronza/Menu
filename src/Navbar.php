<?php

namespace IlBronza\Menu;

use IlBronza\Buttons\Button;

class Navbar
{
	public $name = 'default';

	public $position = 'left';

	public $logo;

	public $roles = [];
	public $exceptRoles = [];
	public $clearfix = false;

	public $buttons;

	public function __construct()
	{
		$this->buttons = collect();
	}

	public function setLogoByParameters(array $parameters)
	{
		$this->logo = Logo::create($parameters);
	}

	public function getLogo()
	{
		return $this->logo;
	}

	public function getButtons()
	{
		return $this->buttons->filter(function(Button $button)
			{
				return $button->userCanView();
			})->sortBy('position');
	}

	public function getAllButtons()
	{
		return $this->buttons;
	}

	public function getButtonsCount()
	{
		return count(
			$this->getAllButtons()
		);
	}

	static function create(array $parameters = [])
	{
		$navbar = new static();

		foreach($parameters as $name => $value)
			$navbar->$name = $value;

		return $navbar;
	}

	public function setClearfix(bool $clearfix = true)
	{
		$this->clearfix = $clearfix;
	}

	public function addButton(Button $button) : Button
	{
		$this->buttons->push($button);

		$button->removeButtonHtmlClass('uk-button');

		$button->navbar = $this;

		return $button;
	}

	public function removeButton(Button $button) : Button
	{
		$this->buttons = $this->buttons->reject(function($item) use($button)
		{
			return $button->name == $item->name;
		})->values();

		return $button;
	}

	public function getPosition()
	{
		return $this->position;
	}

	public function setPosition(string $position)
	{
		return $this->position = $position;
	}

	public function template()
	{
		return app(config('app.template', 'uikittemplate'));
	}

	public function getPositionClass()
	{
		return $this->template()->getNavbarPositionClass($this->position);
	}

	public function getClearfixClass()
	{
		if($this->hasClearfix())
			return $this->template()->getWidthFullClass();
	}

	public function getButtonByName(string $name) : ? Button
	{
		foreach($this->getAllButtons() as $button)
			if($button->getName() == $name)
				return $button;

		return null;
	}

	public function getHtmlClasses()
	{
		$result = [];

		$result[] = $this->getPositionClass();

		$result[] = $this->getClearfixClass();

		return implode(" ", $result);
	}

	public function hasClearfix()
	{
		return $this->clearfix;
	}
}