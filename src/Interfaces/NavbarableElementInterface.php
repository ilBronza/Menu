<?php

namespace IlBronza\Menu\Interfaces;


interface NavbarableElementInterface
{
    public function getButtonUrl() : string;
    public function getIcon() : ? string;
    public function getName() : ? string;
    public function getButtonText() : string;
    public function getButtonBadgeText() : ? string;
}