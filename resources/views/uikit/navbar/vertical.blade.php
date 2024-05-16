<div class="{{ $navbar->getHtmlClasses() }} uk-width-medium">
    <ul class="uk-nav uk-nav-default">
    	@foreach($navbar->getButtons() as $button)
    	{!! $button->navbarRender('vertical') !!}
    	@endforeach
    </ul>
</div>