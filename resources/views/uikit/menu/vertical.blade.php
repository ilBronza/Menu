
	@foreach($menu->getNavbars() as $navbar)

    <div class="{{ $navbar->getHtmlClasses() }} uk-width-medium">
        <ul class="uk-nav-default" uk-nav="multiple: true">
        	@foreach($navbar->getButtons() as $button)
        	{!! $button->navbarRender('vertical') !!}
        	@endforeach
        </ul>
    </div>

    @endforeach
