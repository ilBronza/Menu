// Loaded by ilBronza.menu.js in the application's Webpack/Mix bundle, after UIkit.
// The Blade view supplies only JSON; this module initializes existing and AJAX-inserted menus.
(function (window, document) {
    'use strict';

    if (window.IlBronzaProgressiveMenu) {
        window.IlBronzaProgressiveMenu.init(document);
        return;
    }

    var instances = new WeakMap();
    var sequence = 0;
    var selector = '[data-ib-progressive-menu]';

    function element(tag, classes, text) {
        var node = document.createElement(tag);
        if (classes) node.className = Array.isArray(classes) ? classes.join(' ') : classes;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function safeUrl(value, image) {
        if (!value) return null;
        try {
            var url = new URL(value, document.baseURI);
            return (image ? /^(https?:)$/ : /^(https?:|mailto:|tel:)$/).test(url.protocol) ? value : null;
        } catch (error) { return null; }
    }

    function installStyles() {
        if (document.getElementById('ib-progressive-menu-style')) return;
        var style = element('style');
        style.id = 'ib-progressive-menu-style';
        // Presentation belongs to the existing UIkit/application styles.
        style.textContent = '.ib-menu-expand{cursor:pointer}' +
            '.ib-menu-expand:focus-visible{outline:2px solid currentColor;outline-offset:2px}' +
            '.ib-menu-status{padding:12px;white-space:nowrap}' +
            '.ib-menu-fallback-open{display:block;position:fixed;inset:0;z-index:1000;background:#0006}' +
            '.ib-menu-fallback-open>.uk-offcanvas-bar{transform:none}';
        document.head.appendChild(style);
    }

    function Menu(root, payload) {
        var self = this;
        this.root = root;
        this.payload = payload;
        this.options = payload.options || {};
        this.messages = Object.assign({ loading: 'Loading…', retry: 'Retry', loadError: 'Unable to load menu.', openMenu: 'Open menu', closeMenu: 'Close menu', expand: 'Expand' }, payload.messages);
        this.cache = new Map();
        this.prefix = 'ib-menu-' + (++sequence);
        this.sidebarId = this.options.offcanvasId || this.prefix + '-sidebar';
        var sidebarId = this.sidebarId;
        if (document.getElementById(sidebarId) || Array.from(document.querySelectorAll('[data-menu-hamburger]')).some(function (toggle) { return toggle.getAttribute('aria-controls') === sidebarId; }))
            this.sidebarId = this.prefix + '-sidebar';
        this.domIds = new Map();
        this.nextId = 0;
        this.branches = [];
        this.primary = root;
        root.setAttribute('data-menu-primary', '');
        var script = root.querySelector('script[data-menu-payload]');
        this.primary.replaceChildren();
        this.renderPrimary();
        if (script) root.appendChild(script);
        this.onKeydown = function (event) {
            if (event.key !== 'Escape') return;
            var branch = self.branches.slice().reverse().find(function (entry) { return entry.open && entry.li.contains(event.target); });
            if (branch) {
                event.preventDefault();
                event.stopPropagation();
                branch.close();
                branch.toggle.focus();
            }
        };
        root.addEventListener('keydown', this.onKeydown, true);
    }

    Menu.prototype.id = function (item, view) {
        var key = view + ':' + item.id;
        if (!this.domIds.has(key)) this.domIds.set(key, this.prefix + '-' + view + '-' + (++this.nextId));
        return this.domIds.get(key);
    };

    Menu.prototype.fetchChildren = function (item) {
        var self = this;
        if (this.cache.has(item.id)) return this.cache.get(item.id);
        var promise = Promise.resolve().then(function () {
            var url = new URL(item.childrenUrl, document.baseURI);
            if (!item.childrenUrl || url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) throw new Error('Invalid menu endpoint');
            return window.fetch(url.href, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
        }).then(function (response) {
            if (!response.ok || response.redirected || !/\bapplication\/json\b/i.test(response.headers.get('content-type') || '')) throw new Error('Invalid menu response');
            return response.json();
        }).then(function (data) {
            if (!data || !Array.isArray(data.items)) throw new Error('Invalid menu items');
            return data.items;
        }).catch(function (error) {
            self.cache.delete(item.id);
            throw error;
        });
        this.cache.set(item.id, promise);
        return promise;
    };

    Menu.prototype.logo = function (logo) {
        if (!logo || !safeUrl(logo.path, true)) return null;
        var href = safeUrl(logo.href);
        var link = element(href ? 'a' : 'span', 'uk-navbar-item uk-logo');
        if (href) link.href = href;
        var image = element('img');
        image.src = logo.path;
        image.alt = logo.alt || '';
        if (logo.width) image.style.width = logo.width;
        link.appendChild(image);
        return link;
    };

    Menu.prototype.renderItem = function (item, view, depth, navbar) {
        var self = this;
        var dropdownMode = item.dropdownMode || this.options.dropdownMode || 'hover';
        var template = element('template');
        // These shells come from the same Blade views used by navbarRender().
        template.innerHTML = item.html[view];
        var li = template.content.firstElementChild;
        li.classList.add('ib-menu-item');
        li.setAttribute('data-menu-item', item.id);
        var label = li.querySelector('a');
        label.id = this.id(item, view) + '-label';
        label.classList.add('ib-menu-label');
        // Keep the legacy anchor element, including for groups with no URL.
        // Do not retain executable URLs or inline confirmation handlers.
        var href = safeUrl(item.href);
        if (href) label.setAttribute('href', href);
        else if (item.hasChildren || item.toggle || Object.keys(item.data || {}).length) label.setAttribute('href', '#');
        else label.removeAttribute('href');
        label.removeAttribute('onclick');
        if (item.target === '_blank') label.rel = 'noopener noreferrer';
        li.querySelectorAll('img').forEach(function (image) {
            if (!safeUrl(image.getAttribute('src'), true)) image.remove();
        });
        if (item.disabled) {
            label.setAttribute('aria-disabled', 'true');
            label.tabIndex = -1;
        }
        label.addEventListener('click', function (event) {
            if (item.disabled || (item.confirm && !window.confirm(item.confirm))) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        });
        if (!item.hasChildren) return li;

        // The existing parent icon is the expansion control. No sibling button
        // or text wrapper is added, so UIkit's > li > a selectors still apply.
        var toggle = label.querySelector('[uk-nav-parent-icon]');
        toggle.classList.add('ib-menu-expand');
        toggle.id = this.id(item, view) + '-toggle';
        toggle.tabIndex = item.disabled ? -1 : 0;
        toggle.setAttribute('role', 'button');
        toggle.setAttribute('data-menu-expand', item.id);
        toggle.setAttribute('aria-label', this.messages.expand + ': ' + label.textContent.trim());
        toggle.setAttribute('aria-expanded', 'false');
        if (item.disabled) toggle.setAttribute('aria-disabled', 'true');
        var panel = li.querySelector(':scope > .uk-navbar-dropdown, :scope > .uk-dropdown, :scope > .uk-nav-sub');
        var positionTarget = panel.previousElementSibling;
        panel.id = this.id(item, view) + '-children';
        panel.hidden = true;
        panel.setAttribute('data-menu-children', item.id);
        panel.setAttribute('aria-labelledby', toggle.id);
        toggle.setAttribute('aria-controls', panel.id);
        if (view === 'desktop') toggle.setAttribute('aria-haspopup', 'true');
        var branch = { item: item, li: li, toggle: toggle, panel: panel, view: view, open: false, loaded: false, pending: null, component: null };
        var skeleton = panel.cloneNode(true);
        this.branches.push(branch);

        branch.load = function () {
            if (branch.loaded) return Promise.resolve();
            if (branch.pending) return branch.pending;
            panel.setAttribute('aria-busy', 'true');
            var status = element(view === 'desktop' ? 'div' : 'li', 'ib-menu-status', self.messages.loading);
            status.setAttribute('role', 'status');
            panel.replaceChildren(status);
            branch.pending = self.fetchChildren(item).then(function (items) {
                panel.replaceChildren();
                if (view === 'desktop') self.renderColumns(panel, items, item, depth + 1, skeleton);
                else items.forEach(function (child) { panel.appendChild(self.renderItem(child, view, depth + 1)); });
                branch.loaded = true;
                if (window.UIkit) {
                    window.UIkit.update(panel);
                    // Loading changes the intrinsic width after the initial
                    // opening. Reposition only while this branch is still open.
                    window.requestAnimationFrame(function () {
                        if (branch.open && branch.component && panel.isConnected)
                            branch.component.position();
                    });
                }
            }).catch(function () {
                var error = element(view === 'desktop' ? 'div' : 'li', 'ib-menu-status');
                error.appendChild(element('span', '', self.messages.loadError + ' '));
                var retry = element('button', 'uk-button uk-button-small uk-button-default', self.messages.retry);
                retry.type = 'button';
                retry.setAttribute('data-menu-retry', item.id);
                retry.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); branch.load(); });
                error.appendChild(retry);
                panel.replaceChildren(error);
            }).finally(function () {
                panel.removeAttribute('aria-busy');
                branch.pending = null;
            });
            return branch.pending;
        };

        branch.show = function () {
            if (item.disabled) return;
            branch.open = true;
            toggle.setAttribute('aria-expanded', 'true');
            panel.hidden = false;
            li.classList.add('uk-open');
            if (view === 'desktop' && window.UIkit) {
                branch.component = branch.component || self.dropdown(panel, dropdownMode, depth, navbar);
                // Older UIkit releases accept a toggle reference; newer ones
                // accept its DOM element. Both must position against the link.
                var acceptsElement = 'target' in branch.component.$options.props;
                branch.component.show(acceptsElement ? positionTarget : { $el: positionTarget }, false);
            } else if (view === 'desktop') panel.style.display = 'block';
            return branch.load();
        };
        branch.close = function () {
            branch.open = false;
            toggle.setAttribute('aria-expanded', 'false');
            li.classList.remove('uk-open');
            if (branch.component) branch.component.hide(false);
            else {
                panel.hidden = true;
                panel.style.removeProperty('display');
            }
        };
        // Register before the shell is attached: uk-navbar and uk-dropdown
        // must reuse this component instead of attaching a second link toggle.
        if (view === 'desktop' && window.UIkit) branch.component = this.dropdown(panel, dropdownMode, depth, navbar);
        panel.addEventListener('show', function (event) {
            if (event.target !== panel) return;
            branch.open = true;
            toggle.setAttribute('aria-expanded', 'true');
            branch.load();
        });
        panel.addEventListener('hide', function (event) {
            if (event.target !== panel) return;
            branch.open = false;
            toggle.setAttribute('aria-expanded', 'false');
            li.classList.remove('uk-open');
        });
        var expand = function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (item.disabled) return;
            if (branch.open) branch.close();
            else branch.show();
        };
        toggle.addEventListener('click', expand);
        toggle.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') expand(event);
        });
        label.addEventListener('click', function (event) {
            if (event.target === toggle || toggle.contains(event.target)) return;
            if ((!href || item.href === '#') && !item.toggle && !Object.keys(item.data || {}).length) expand(event);
        });
        var openFromKeyboard = function (event) {
            if (item.disabled) return;
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            event.stopPropagation();
            var control = event.currentTarget;
            branch.show().then(function () {
                if (!branch.open || document.activeElement !== control) return;
                var first = panel.querySelector('a[href]:not([aria-disabled=true]),button:not([disabled])');
                if (first) first.focus();
            });
        };
        toggle.addEventListener('keydown', openFromKeyboard);
        label.addEventListener('keydown', openFromKeyboard);
        if (view === 'desktop' && dropdownMode.indexOf('hover') !== -1) {
            var timer;
            li.addEventListener('pointerenter', function (event) {
                if (event.pointerType === 'touch') return;
                window.clearTimeout(timer);
                branch.show();
            });
            li.addEventListener('pointerleave', function (event) {
                if (event.pointerType === 'touch') return;
                timer = window.setTimeout(function () {
                    if (!li.contains(document.activeElement)) branch.close();
                }, 180);
            });
            li.addEventListener('focusout', function () {
                window.setTimeout(function () {
                    if (!li.contains(document.activeElement) && !li.matches(':hover')) branch.close();
                }, 0);
            });
        }
        return li;
    };

    Menu.prototype.dropdown = function (panel, mode, depth, navbar) {
        if (!depth) {
            // Navbar uses `drop`: `dropdown` also adds uk-dropdown, changing
            // the navbar's CSS width, minimum width, padding and offsets.
            var hasAxisBoundaries = 'boundaryX' in window.UIkit.component('drop').options.props;
            return window.UIkit.drop(panel, {
                toggle: false, mode: mode, pos: 'bottom-left',
                clsDrop: 'uk-navbar-dropdown',
                flip: hasAxisBoundaries ? false : 'x', shift: true, autoUpdate: false,
                boundary: hasAxisBoundaries ? false : navbar || window,
                boundaryX: navbar || false,
            });
        }
        return window.UIkit.dropdown(panel, { toggle: false, mode: mode, pos: 'right-top' });
    };

    Menu.prototype.renderColumns = function (panel, items, parent, depth, skeleton) {
        var contents = skeleton.cloneNode(true);
        var walker = document.createTreeWalker(contents, window.NodeFilter.SHOW_COMMENT);
        var slots = [];
        while (walker.nextNode()) {
            if (walker.currentNode.data === 'ib-menu-slot') slots.push(walker.currentNode);
        }
        // Fill the original Blade grid, preserving its column boundaries and
        // any application classes. Rebuild only if the branch changed in size.
        if (slots.length === items.length) {
            var self = this;
            slots.forEach(function (slot, index) { slot.replaceWith(self.renderItem(items[index], 'desktop', depth)); });
            panel.append.apply(panel, Array.from(contents.childNodes));
            return;
        }
        var grid = element('div', 'uk-navbar-dropdown-grid');
        grid.setAttribute('uk-grid', '');
        var size = Math.max(1, Number(parent.childrenPerColumn) || 10);
        var columns = Math.max(1, Number(parent.childrenColumnNumber) || Math.ceil(items.length / size));
        grid.classList.add('uk-child-width-1-' + Math.min(columns, 6));
        for (var start = 0; start < items.length; start += size) {
            var column = element('div');
            var list = element('ul', 'uk-nav uk-navbar-dropdown-nav ib-menu-desktop');
            for (var index = start; index < Math.min(start + size, items.length); index++) list.appendChild(this.renderItem(items[index], 'desktop', depth));
            column.appendChild(list);
            grid.appendChild(column);
        }
        panel.appendChild(grid);
    };

    Menu.prototype.renderPrimary = function () {
        var self = this;
        var container = this.options.sticky ? element('div', 'uk-navbar-container') : this.root;
        container.classList.add('uk-navbar-container');
        var inner = element('div', 'uk-container' + (this.options.fullWidth ? ' uk-container-expand' : ''));
        container.appendChild(inner);
        var nav = element('nav', 'uk-navbar ' + (this.options.wrapClass || ''));
        var navbarAttribute = this.options.dropdownMode ? 'mode: ' + this.options.dropdownMode : '';
        nav.setAttribute('uk-navbar', navbarAttribute);
        inner.appendChild(nav);
        (this.payload.navbars || []).filter(function (navbar) { return navbar.orientation === 'horizontal'; }).forEach(function (navbar) {
            if (navbar.breakRow) {
                nav = element('nav', 'uk-navbar-container ' + (self.options.wrapClass || ''));
                nav.setAttribute('uk-navbar', navbarAttribute);
                inner.appendChild(nav);
            }
            var section = element('div', navbar.classes);
            section.classList.add('uk-visible@l');
            var logo = self.logo(navbar.logo);
            if (logo) section.appendChild(logo);
            var list = element('ul', 'uk-navbar-nav ib-menu-desktop');
            (navbar.items || []).forEach(function (item) { list.appendChild(self.renderItem(item, 'desktop', 0, nav)); });
            section.appendChild(list);
            nav.appendChild(section);
        });
        if (this.options.sticky) {
            this.root.setAttribute('uk-sticky', 'sel-target: .uk-navbar-container; cls-active: uk-navbar-sticky; end: + *; offset: ' + (this.options.stickyOffset || 0));
            this.primary.appendChild(container);
        }
        if (this.options.offcanvas) {
            var mobile = element('div', 'uk-navbar-right uk-hidden@l');
            var list = element('ul', 'uk-navbar-nav');
            var li = element('li');
            var template = element('template');
            template.innerHTML = this.options.offcanvasButtonHtml;
            li.appendChild(template.content);
            var toggle = li.querySelector('a');
            toggle.id = this.prefix + '-hamburger';
            toggle.removeAttribute('onclick');
            toggle.setAttribute('href', '#');
            toggle.setAttribute('aria-label', this.messages.openMenu);
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-controls', this.sidebarId);
            toggle.setAttribute('uk-toggle', 'target: #' + this.sidebarId);
            toggle.setAttribute('data-menu-hamburger', '');
            list.appendChild(li);
            mobile.appendChild(list);
            this.root.after(mobile);
            this.mobile = mobile;
            toggle.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopImmediatePropagation();
                self.openSidebar(toggle);
            });
        }
    };

    Menu.prototype.openSidebar = function (toggle) {
        var self = this;
        if (!this.sidebar) {
            this.sidebar = element('div', 'ib-menu-sidebar');
            this.sidebar.id = this.sidebarId;
            this.sidebar.setAttribute('uk-offcanvas', '');
            this.sidebar.setAttribute('aria-label', this.messages.openMenu);
            var bar = element('div', 'uk-offcanvas-bar');
            var content = element('div', 'uk-width-xlarge');
            bar.appendChild(content);
            var close = element('button', 'uk-offcanvas-close');
            close.type = 'button';
            close.setAttribute('uk-close', '');
            close.setAttribute('aria-label', this.messages.closeMenu);
            content.appendChild(close);
            this.sidebar.appendChild(bar);
            (this.payload.navbars || []).forEach(function (navbar) {
                var section = element('div', navbar.classes);
                section.classList.add('uk-width-medium');
                var logo = self.options.showLogo === false ? null : self.logo(navbar.logo);
                if (logo) section.appendChild(logo);
                var list = element('ul', 'uk-nav-default uk-text-left');
                list.setAttribute('uk-nav', 'multiple: true');
                // Expansion is managed here to keep lazy state and parent links.
                if (window.UIkit) window.UIkit.nav(list, { targets: '> .uk-parent:not(.ib-menu-item)', multiple: true });
                (navbar.items || []).forEach(function (item) { list.appendChild(self.renderItem(item, 'sidebar', 0)); });
                section.appendChild(list);
                content.appendChild(section);
            });
            this.sidebar.addEventListener('hidden', function (event) {
                if (event.target === self.sidebar) toggle.setAttribute('aria-expanded', 'false');
            });
            var closeFallback = function () {
                if (window.UIkit) window.UIkit.offcanvas(self.sidebar).hide();
                else self.sidebar.classList.remove('ib-menu-fallback-open');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.focus();
            };
            close.addEventListener('click', closeFallback);
            this.sidebar.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !event.defaultPrevented) closeFallback(); });
            this.sidebar.addEventListener('keydown', this.onKeydown, true);
            this.mobile.after(this.sidebar);
        }
        toggle.setAttribute('aria-expanded', 'true');
        if (window.UIkit) window.UIkit.offcanvas(this.sidebar, { container: false }).show();
        else {
            this.sidebar.classList.add('ib-menu-fallback-open');
            this.sidebar.querySelector('button').focus();
        }
    };

    function init(scope) {
        var roots = scope.matches && scope.matches(selector) ? [scope] : [];
        if (scope.querySelectorAll) roots = roots.concat(Array.from(scope.querySelectorAll(selector)));
        roots.forEach(function (root) {
            if (instances.has(root)) return;
            var script = root.querySelector('script[data-menu-payload]');
            if (!script) return;
            var payload;
            try { payload = JSON.parse(script.textContent); } catch (error) { return; }
            if (payload.version !== 1 || !Array.isArray(payload.navbars)) return;
            installStyles();
            instances.set(root, new Menu(root, payload));
        });
    }

    window.IlBronzaProgressiveMenu = { init: init };
    function start() {
        init(document);
        // Look up connected roots instead of retaining removed AJAX menus in document listeners.
        document.addEventListener('click', function (event) {
            document.querySelectorAll(selector).forEach(function (root) {
                var menu = instances.get(root);
                if (!menu) return;
                menu.branches.forEach(function (branch) {
                    if (branch.view === 'desktop' && branch.open && !branch.li.contains(event.target)) branch.close();
                });
            });
        });
        new MutationObserver(function (records) {
            records.forEach(function (record) {
                record.removedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    var roots = node.matches(selector) ? [node] : Array.from(node.querySelectorAll(selector));
                    roots.forEach(function (root) {
                        var menu = instances.get(root);
                        if (!menu || root.isConnected) return;
                        if (menu.sidebar) {
                            if (window.UIkit) window.UIkit.offcanvas(menu.sidebar).hide();
                            menu.sidebar.remove();
                        }
                        if (menu.mobile) menu.mobile.remove();
                        root.removeEventListener('keydown', menu.onKeydown, true);
                        instances.delete(root);
                    });
                });
                record.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    var root = node.closest(selector);
                    init(root || node);
                });
            });
        }).observe(document.documentElement, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})(window, document);
