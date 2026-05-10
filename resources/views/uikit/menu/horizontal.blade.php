@php
	$stickyAttrs = $menu->getSticky()
		? 'sel-target: .uk-navbar-container; cls-active: uk-navbar-sticky; end: + *; offset: ' . $menu->getStickyOffset()
		: null;
	/** Allineamento doc UIkit: mode su uk-navbar così tutti i .uk-navbar-dropdown prendono lo stesso comportamento. */
	$navbarMode = trim((string) config('menu.buttons.dropdownMode', 'click'));
	$navbarUkNavbarAttr = $navbarMode !== '' ? 'mode: ' . $navbarMode : null;
@endphp
@if($menu->getSticky())
<div uk-sticky="{{ $stickyAttrs }}">
@endif
<div class="uk-navbar-container">
	<div class="uk-container @if($menu->isFullWidth()) uk-container-expand @endif">
		<nav class="uk-navbar {{ $menu->getWrapClass() }}" @if($navbarUkNavbarAttr) uk-navbar="{{ $navbarUkNavbarAttr }}" @else uk-navbar @endif>

	@foreach($menu->getNavbarsByOrientation('horizontal') as $navbar)

		@if($navbar->mustBreakRow())

		</nav>
		<nav class="uk-navbar-container {{ $menu->getWrapClass() }}" @if($navbarUkNavbarAttr) uk-navbar="{{ $navbarUkNavbarAttr }}" @else uk-navbar @endif>

		@endif

	{!! $navbar->render() !!}

	@endforeach

		</nav>
	</div>
</div>
@if($menu->getSticky())
</div>
@endif

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
