@if($logo->getHref())
<a class="uk-navbar-item uk-logo" href="{{ $logo->getHref() }}">
@else
<span class="uk-navbar-item uk-logo">
@endif

	<img style="{{ $logo->getWidthCssString() }}" src="{{ $logo->getPath() }}" />

@if($logo->getHref())
</a>
@else
</span>
@endif