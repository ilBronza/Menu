<div class="{{ $navbar->getHtmlClasses() }} uk-visible@l">

	@if($logo = $navbar->getLogo())
		{!! $logo->render() !!}
	@endif

	<ul class="uk-navbar-nav">
		@foreach($navbar->getButtons() as $button)
			{!! $button->navbarRender('horizontal') !!}
		@endforeach
	</ul>
</div>
