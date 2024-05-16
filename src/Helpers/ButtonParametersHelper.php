<?php

namespace IlBronza\Menu\Helpers;

use Illuminate\Database\Eloquent\Model;

class ButtonParametersHelper
{
	static function extractFromModel(Model $model) : array
	{
		return [
			'name' => $model->getName(),
			'text' => $model->getButtonText(),
			'href' => $model->getButtonUrl(),
			'icon' => $model->getIcon(),
			'badge' => $model->getButtonBadgeText()
		];
	}

	static function addActiveParameter(array $parameters) : array
	{
		$parameters['active'] = true;

		return $parameters;
	}
}