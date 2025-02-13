<div class="uk-navbar-container">
	<div class="uk-container">
		<nav class="uk-navbar {{ $menu->getWrapClass() }}" uk-navbar>

	@foreach($menu->getNavbarsByOrientation('horizontal') as $navbar)

		@if($navbar->mustBreakRow())

		</nav>
		<nav class="uk-navbar-container {{ $menu->getWrapClass() }}" uk-navbar>

		@endif

	{!! $navbar->render() !!}

	@endforeach

		</nav>
	</div>
</div>

@if($menu->hasOffCanvas())
	<div class="uk-navbar-right uk-hidden@l">
		<ul class="uk-navbar-nav">
			<li>
				{!! $menu->getOffCanvasButton()->renderButton() !!}
			</li>
		</ul>
	</div>
@endif


@if($menu->hasOffCanvas())
{!! $menu->renderOffcanvas() !!}
@endif
