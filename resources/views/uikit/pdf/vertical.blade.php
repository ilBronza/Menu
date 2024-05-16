<div class="{{ $navbar->getHtmlClasses() }}">
    <ul>
    	@foreach($navbar->getButtons() as $button)
            @include('buttons::uikit.navbar.pdf', ['buttonParentLevel' => $loop->index + 1])
    	@endforeach
    </ul>
</div>