<?php

namespace IlBronza\Menu\Helpers;

use IlBronza\Buttons\Button;
use IlBronza\CRUD\Interfaces\RecursiveTreeInterface;
use IlBronza\Menu\Navbar;
use Illuminate\Database\Eloquent\Model;

class MenuTreeCreatorHelper
{
	public Navbar $navbar;
	public ? RecursiveTreeInterface $activeNode = null;

	public function setNavbar(string $navbarName)
	{
		$this->navbar = app('menu')->getNavbarByName($navbarName);
	}

	public function getNavbar() : Navbar
	{
		return $this->navbar;
	}

	public function addDropdownElements(Button $button, Collection $children)
	{
		dd(
			get_class_methods($button)
		);
		foreach($children as $child)
			$button->addDropdownElement($button, $element);
	}

	private function checkIfNodeIsActive(RecursiveTreeInterface $tree) : bool
	{
		if(! $activeNode = $this->getActiveNode())
			return false;

		return $tree->getKey() == $activeNode->getKey();
	}


	public function addChildrenToParent($parent, RecursiveTreeInterface $tree)
	{
		$buttonParameters = ButtonParametersHelper::extractFromModel($tree);

		if($active = $this->checkIfNodeIsActive($tree))
			$buttonParameters = ButtonParametersHelper::addActiveParameter($buttonParameters);

		$button = Button::create($buttonParameters);

		$button->setDropdownMode('hover');

		$parent->addButton($button);

		if(($active)&&(method_exists($parent, 'setContainsActiveElement')))
			$parent->setContainsActiveElement();

		foreach($tree->getContentElements() as $element)
			$this->addContentElementsToParent($button, $element);

		foreach($tree->getRecursiveChildren() as $child)
			$this->addChildrenToParent($button, $child);
	}

	public function addContentElementsToParent($parent, Model $model)
	{
		$buttonParameters = ButtonParametersHelper::extractFromModel($model);

		$button = Button::create($buttonParameters);

		$button->setDropdownMode('hover');

		foreach($model->getContentElements() as $element)
			$this->addContentElementsToParent($button, $element);

		$parent->addButton($button);
	}

	public function setActiveNode(RecursiveTreeInterface $activeNode)
	{
		$this->activeNode = $activeNode;
	}

	public function getActiveNode() : ? RecursiveTreeInterface
	{
		return $this->activeNode;
	}

	static function createNavbarFromRecursiveTree(string $navbarName, RecursiveTreeInterface $tree, RecursiveTreeInterface $activeNode = null) : Navbar
	{
		$helper = new static();

		$helper->setNavbar($navbarName);
		$helper->setActiveNode($activeNode);

		$helper->addChildrenToParent(
			$helper->getNavbar(),
			$tree
		);

		return $helper->getNavbar();
	}
}