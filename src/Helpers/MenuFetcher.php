<?php

namespace IlBronza\Menu\Helpers;

use IlBronza\UikitTemplate\Fetcher;

/** Keep Fetcher's marker separate from the menu's page-context query parameter. */
class MenuFetcher extends Fetcher
{
    public function getUrl()
    {
        return $this->url . (str_contains($this->url, '?') ? '&' : '?') . 'ibFetcher=true';
    }
}
