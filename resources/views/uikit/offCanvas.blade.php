
<div id="{{ $menu->getContainerId() }}" uk-offcanvas>
    <div class="uk-offcanvas-bar">
        <div
        class="uk-width-xlarge"
        >


            <button class="uk-offcanvas-close" type="button" uk-close></button>

            @foreach($menu->getNavbars() as $navbar)

            <div class="{{ $navbar->getHtmlClasses() }} uk-width-medium">

                @if(($menu->showLogo())&&($logo = $navbar->getLogo()))
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
</div>