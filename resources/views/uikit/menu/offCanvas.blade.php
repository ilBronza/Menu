<div id="{{ $menu->getContainerId() }}" uk-offcanvas data-ib-menu-offcanvas data-menu-open-active-path="{{ config('menu.active.openMobilePath', true) ? 'true' : 'false' }}">
    <div class="uk-offcanvas-bar">
        <button class="uk-offcanvas-close" type="button" uk-close aria-label="{{ trans('menu::menu.closeMenu') }}"></button>

        @foreach($menu->getNavbars() as $navbar)
            <div class="{{ $navbar->getCustomHtmlClassesString() }}">
                @if($menu->showLogo() && ($logo = $navbar->getLogo()))
                    {!! $logo->render() !!}
                @endif
                <ul class="uk-nav-default uk-text-left" uk-nav="multiple: true">
                    @foreach($navbar->getButtons() as $button)
                        {!! $button->navbarRender('vertical') !!}
                    @endforeach
                </ul>
            </div>
        @endforeach
    </div>
</div>
