@php
	$stickyAttrs = $menu->getSticky()
		? 'sel-target: .uk-navbar-container; cls-active: uk-navbar-sticky; end: + *; offset: ' . $menu->getStickyOffset()
		: null;
	/** Allineamento doc UIkit: mode su uk-navbar così tutti i .uk-navbar-dropdown prendono lo stesso comportamento. */
	$navbarMode = trim((string) config('menu.buttons.dropdownMode', 'hover'));
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
		<nav class="uk-navbar {{ $menu->getWrapClass() }}" @if($navbarUkNavbarAttr) uk-navbar="{{ $navbarUkNavbarAttr }}" @else uk-navbar @endif>

		@endif

	{!! $navbar->render() !!}

	@endforeach

	@if($menu->hasOffCanvas())
        <div class="uk-navbar-right uk-hidden@l">
            <a class="uk-navbar-toggle" href="#{{ $menu->getContainerId() }}" uk-toggle="target: #{{ $menu->getContainerId() }}" aria-label="{{ trans('menu::menu.openMenu') }}">
                <span uk-navbar-toggle-icon></span>
            </a>
        </div>
	@endif

		</nav>
	</div>
</div>
@if($menu->getSticky())
</div>
@endif

@if($menu->hasOffCanvas())
{!! $menu->renderOffcanvas() !!}
@endif
