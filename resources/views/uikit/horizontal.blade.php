<nav class="uk-navbar-container {{ $menu->getWrapClass() }}" uk-navbar>

	@foreach($menu->getNavbars() as $navbar)

		@if($navbar->mustBreakRow())

</nav>
<nav class="uk-navbar-container {{ $menu->getWrapClass() }}" uk-navbar>

		@endif
	
	<div class="{{ $navbar->getHtmlClasses() }} uk-visible@l">

		@if(($menu->showLogo())&&($logo = $navbar->getLogo()))
			{!! $logo->render() !!}
		@endif

		<ul class="uk-navbar-nav">
			@foreach($navbar->getButtons() as $button)
				{!! $button->navbarRender('horizontal') !!}
			@endforeach
		</ul>
	</div>
	@endforeach

@if($menu->hasOffCanvas())
	<div class="uk-navbar-right uk-hidden@l">
		<ul class="uk-navbar-nav">
			<li>
				{!! $menu->getOffCanvasButton()->renderButton() !!}
			</li>
		</ul>
	</div>
@endif

</nav>


@if($menu->hasOffCanvas())
{!! app('menu')->render('offCanvas') !!}
@endif
