<div @if($menu->getSticky()) uk-sticky="sel-target: .uk-navbar-container; cls-active: uk-navbar-sticky; end: + *; offset: {{ $menu->getStickyOffset() }}" @else class="uk-navbar-container" @endif data-ib-progressive-menu data-menu-primary>
    <script type="application/json" data-menu-payload>{!! json_encode($payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) !!}</script>
    <noscript>
        @foreach($payload['navbars'] as $navbar)
            <ul>
                @foreach($navbar['items'] as $item)
                    @if(! empty($item['href']) && empty($item['disabled']))
                        <li><a href="{{ $item['href'] }}">{!! $item['text'] !!}</a></li>
                    @endif
                @endforeach
            </ul>
        @endforeach
    </noscript>
</div>
