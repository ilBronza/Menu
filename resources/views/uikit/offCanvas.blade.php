
<div id="{{ $menu->getContainerId() }}" uk-offcanvas>
    <div class="uk-offcanvas-bar">

        <button class="uk-offcanvas-close" type="button" uk-close></button>

        @foreach($menu->getNavbars() as $navbar)

        <div class="{{ $navbar->getHtmlClasses() }} uk-width-medium">
            <ul class="uk-nav-default" uk-nav="multiple: true">
                @foreach($navbar->getButtons() as $button)
                {!! $button->navbarRender('vertical') !!}
                @endforeach
            </ul>
        </div>

        @endforeach

    </div>
</div>