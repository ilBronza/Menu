// Loaded by ilBronza.menu.js in the application's Webpack/Mix bundle, after UIkit.
// The Blade view supplies only JSON; this module initializes existing and AJAX-inserted menus.
(function (window, document) {
    'use strict';

    if (window.IlBronzaProgressiveMenu) {
        window.IlBronzaProgressiveMenu.init(document);
        return;
    }

    var instances = new WeakMap();
    var legacySidebars = new WeakSet();
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

    function validItems(items) {
        return Array.isArray(items) && items.every(function (item) {
            return item && typeof item.id === 'string' && item.html &&
                typeof item.html.desktop === 'string' && typeof item.html.sidebar === 'string' &&
                (!item.hasChildren || typeof item.childrenUrl === 'string');
        });
    }

    function menuError(code, retryable) {
        var error = new Error(code);
        error.menuCode = code;
        error.retryable = retryable;
        return error;
    }

    function loginUrl(value) {
        if (!value) return null;
        try {
            var url = new URL(value, document.baseURI);
            return /^https?:$/.test(url.protocol) ? url : null;
        } catch (error) { return null; }
    }

    var storageKey = 'ib-menu-branches:v1';
    function BranchStorage(options, hasActiveState) {
        this.options = options || {};
        this.storage = null;
        try {
            if (options && options.enabled === false) {
                window.sessionStorage.removeItem(storageKey);
                return;
            }
            if (!options || !options.enabled || !hasActiveState || !/^[a-f0-9]{64}$/.test(options.key || '') ||
                !Number.isFinite(options.ttlSeconds) || options.ttlSeconds <= 0) return;
            this.storage = window.sessionStorage;
            var saved = this.readStore();
            if (!saved || saved.scope !== options.key) this.saveStore({ version: 1, scope: options.key, entries: {} });
        } catch (error) { this.storage = null; }
    }

    BranchStorage.prototype.readStore = function () {
        if (!this.storage) return null;
        try {
            var saved = JSON.parse(this.storage.getItem(storageKey));
            return saved && saved.version === 1 && saved.entries && typeof saved.entries === 'object' && !Array.isArray(saved.entries) ? saved : null;
        } catch (error) { return null; }
    };

    BranchStorage.prototype.saveStore = function (saved) {
        try { this.storage.setItem(storageKey, JSON.stringify(saved)); }
        catch (error) { this.storage = null; }
    };

    BranchStorage.prototype.token = function (item) {
        return /^[a-f0-9]{64}$/.test(item.childrenCacheKey || '') ? item.childrenCacheKey + ':' + item.id : null;
    };

    BranchStorage.prototype.read = function (item, url) {
        var token = this.token(item);
        var saved = this.readStore();
        if (!token || !saved || saved.scope !== this.options.key) return null;
        var entry = saved.entries[token];
        if (!entry) return null;
        var now = Date.now();
        if (!Number.isFinite(entry.createdAt) || !Number.isFinite(entry.expiresAt) || entry.createdAt > now ||
            Math.min(entry.expiresAt, entry.createdAt + this.options.ttlSeconds * 1000) <= now || entry.url !== url || !validItems(entry.items)) {
            delete saved.entries[token];
            this.saveStore(saved);
            return null;
        }
        return entry.items;
    };

    BranchStorage.prototype.write = function (item, url, items) {
        var token = this.token(item);
        var saved = this.readStore();
        // A response from a previous login/context must not restore its scope.
        if (!token || !saved || saved.scope !== this.options.key || !validItems(items)) return;
        var now = Date.now();
        Object.keys(saved.entries).forEach(function (key) {
            if (!saved.entries[key] || saved.entries[key].expiresAt <= now) delete saved.entries[key];
        });
        // Page state is always supplied by the fresh root manifest.
        var contents = items.map(function (item) {
            var copy = Object.assign({}, item);
            delete copy.active;
            delete copy.containsActive;
            return copy;
        });
        saved.entries[token] = { createdAt: now, expiresAt: now + this.options.ttlSeconds * 1000, url: url, items: contents };
        var limit = Math.max(1, Math.min(100, Number(this.options.maxEntries) || 50));
        var keys = Object.keys(saved.entries).sort(function (first, second) {
            return saved.entries[first].createdAt - saved.entries[second].createdAt;
        });
        keys.slice(0, Math.max(0, keys.length - limit)).forEach(function (key) { delete saved.entries[key]; });
        this.saveStore(saved);
    };

    BranchStorage.prototype.remove = function (item) {
        var token = this.token(item);
        var saved = this.readStore();
        if (!token || !saved || saved.scope !== this.options.key) return;
        delete saved.entries[token];
        this.saveStore(saved);
    };

    BranchStorage.prototype.clear = function () {
        var saved = this.readStore();
        if (saved && saved.scope === this.options.key) {
            try { this.storage.removeItem(storageKey); } catch (error) {}
        }
        this.storage = null;
    };

    function installStyles() {
        if (document.getElementById('ib-progressive-menu-style')) return;
        var style = element('style');
        style.id = 'ib-progressive-menu-style';
        // Presentation belongs to the existing UIkit/application styles.
        style.textContent = '.ib-menu-status{padding:12px;white-space:normal}' +
            '.ib-menu-fallback-open{display:block;position:fixed;inset:0;z-index:1000;background:#0006}' +
            '.ib-menu-fallback-open>.uk-offcanvas-bar{transform:none}';
        document.head.appendChild(style);
    }

    function Menu(root, payload) {
        var self = this;
        this.root = root;
        this.payload = payload;
        this.options = payload.options || {};
        this.activeItems = payload.activeState ? new Set(payload.activeState.items || []) : null;
        this.activeAncestors = payload.activeState ? new Set(payload.activeState.ancestors || []) : null;
        this.messages = Object.assign({ loading: 'Loading…', retry: 'Retry', loadError: 'Unable to load menu.', timeout: 'The menu is taking too long to load.', networkError: 'Connection problem. Check your network and retry.', sessionExpired: 'Your session has expired. Sign in again to continue.', accessDenied: 'You do not have access to these menu items.', branchUnavailable: 'These menu items are no longer available.', login: 'Sign in', reload: 'Reload page', openMenu: 'Open menu', closeMenu: 'Close menu', expand: 'Expand' }, payload.messages);
        this.cache = new Map();
        this.branchStorage = new BranchStorage(payload.browserCache, !!payload.activeState);
        this.sessionError = null;
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

    Menu.prototype.downloadChildren = function (item, url) {
        var self = this;
        var controller = window.AbortController ? new window.AbortController() : null;
        var configuredTimeout = Number(this.options.requestTimeoutMs);
        var timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? Math.min(configuredTimeout, 2147483647) : 10000;
        var timer;
        var deadline = new Promise(function (resolve, reject) {
            timer = window.setTimeout(function () {
                reject(menuError('timeout', true));
                if (controller) controller.abort();
            }, timeoutMs);
        });
        var request = Promise.resolve().then(function () {
            var options = { credentials: 'same-origin', headers: { Accept: 'application/json' } };
            if (controller) options.signal = controller.signal;
            return window.fetch(url.href, options);
        }).then(function (response) {
            if (response.status === 401 || response.status === 419) throw menuError('sessionExpired', false);
            if (response.status === 403) throw menuError('accessDenied', false);
            if (response.status === 404 || response.status === 410) throw menuError('branchUnavailable', false);
            if (response.status === 408) throw menuError('timeout', true);
            if (!response.ok) throw menuError('loadError', response.status >= 500 || response.status === 429);
            if (response.redirected) {
                var destination = loginUrl(response.url);
                var login = loginUrl(self.options.loginUrl);
                if (destination && login && destination.origin === login.origin && destination.pathname === login.pathname)
                    throw menuError('sessionExpired', false);
                throw menuError('loadError', true);
            }
            if (!/\bapplication\/json\b/i.test(response.headers.get('content-type') || '')) throw menuError('loadError', true);
            return response.json();
        }).then(function (data) {
            if (!data || !validItems(data.items) || (data.id !== undefined && data.id !== item.id)) throw menuError('loadError', true);
            return data.items;
        });
        // The deadline also covers slow response bodies, and settles even when
        // a browser or fetch wrapper does not reject promptly after abort().
        return Promise.race([request, deadline]).catch(function (error) {
            if (error.menuCode) throw error;
            throw menuError(error.name === 'SyntaxError' ? 'loadError' : 'networkError', true);
        }).finally(function () { window.clearTimeout(timer); });
    };

    Menu.prototype.fetchChildren = function (item) {
        var self = this;
        if (this.sessionError) return Promise.reject(this.sessionError);
        if (this.cache.has(item.id)) return this.cache.get(item.id);
        var promise = Promise.resolve().then(function () {
            var url = new URL(item.childrenUrl, document.baseURI);
            if (!item.childrenUrl || url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) throw menuError('loadError', false);
            var cached = self.branchStorage.read(item, url.href);
            if (cached) return cached;
            return self.downloadChildren(item, url).then(function (items) {
                if (self.sessionError) throw self.sessionError;
                self.branchStorage.write(item, url.href, items);
                return items;
            });
        }).catch(function (error) {
            self.cache.delete(item.id);
            if (error.menuCode === 'sessionExpired') {
                self.sessionError = error;
                self.cache.clear();
                self.branchStorage.clear();
                self.branches.forEach(function (branch) {
                    if (branch.panel.isConnected && (branch.loaded || branch.pending || branch.open)) branch.showError(error);
                });
            }
            if (self.sessionError) throw self.sessionError;
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
        var active = this.activeItems ? this.activeItems.has(item.id) : !!item.active;
        var containsActive = this.activeAncestors ? this.activeAncestors.has(item.id) : !!item.containsActive;
        var dropdownMode = item.dropdownMode || this.options.dropdownMode || 'hover';
        var template = element('template');
        template.innerHTML = item.html[view];
        var li = template.content.firstElementChild;
        li.classList.add('ib-menu-item');
        li.classList.toggle('uk-active', active || containsActive);
        li.setAttribute('data-menu-item', item.id);
        var label = li.querySelector('a');
        label.id = this.id(item, view) + '-label';
        label.classList.add('ib-menu-label');
        label.classList.toggle('uk-text-bold', active || /(^|\s)uk-text-bold(\s|$)/.test(item.classes || ''));
        if (active) label.setAttribute('aria-current', 'page');
        else label.removeAttribute('aria-current');
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

        var panel = li.querySelector(':scope > .uk-navbar-dropdown, :scope > .uk-dropdown, :scope > .uk-nav-sub');
        var positionTarget = panel.previousElementSibling;
        var separateAction = !!item.toggle || Object.keys(item.data || {}).length > 0;
        var toggle = label;
        // External toggles/AJAX actions keep their own anchor. Their submenu
        // gets a real button instead of an interactive span inside that link.
        if (separateAction) {
            li.classList.add('uk-flex', 'uk-flex-middle');
            if (view === 'sidebar') {
                li.classList.add('uk-flex-wrap');
                label.classList.add('uk-flex-1');
                panel.classList.add('uk-width-1-1');
            }
            toggle = element('button', (view === 'desktop' && !depth ? 'uk-navbar-toggle' : 'uk-button uk-button-text') + ' ib-menu-expand');
            toggle.type = 'button';
            var icon = label.querySelector('[uk-navbar-parent-icon],[uk-drop-parent-icon],[uk-nav-parent-icon]');
            if (icon) toggle.appendChild(icon);
            else toggle.textContent = '▾';
            li.insertBefore(toggle, panel);
            toggle.id = this.id(item, view) + '-toggle';
            toggle.setAttribute('aria-label', this.messages.expand + ': ' + label.textContent.trim());
        }
        toggle.classList.add('ib-menu-native-toggle');
        toggle.setAttribute('data-menu-expand', item.id);
        toggle.setAttribute('aria-expanded', 'false');
        if (item.disabled) {
            toggle.setAttribute('aria-disabled', 'true');
            toggle.tabIndex = -1;
            if (toggle.tagName === 'BUTTON') toggle.disabled = true;
        }
        panel.id = this.id(item, view) + '-children';
        panel.setAttribute('data-menu-children', item.id);
        panel.setAttribute('aria-labelledby', toggle.id);
        toggle.setAttribute('aria-controls', panel.id);
        if (view === 'desktop') toggle.setAttribute('aria-haspopup', 'true');
        var skeleton = panel.cloneNode(true);
        var branch = { item: item, li: li, toggle: toggle, panel: panel, view: view, containsActive: containsActive, activePathOpened: false, open: false, loaded: false, pending: null, component: null };
        this.branches.push(branch);
        var native = !!window.UIkit;
        // CSS hides desktop drops; the Nav component controls mobile content.
        if (!native || view === 'sidebar') panel.hidden = true;
        else panel.removeAttribute('hidden');

        branch.showError = function (failure) {
            var problem = failure && failure.menuCode ? failure : menuError('loadError', true);
            self.cache.delete(item.id);
            self.branchStorage.remove(item);
            branch.loaded = false;
            panel.removeAttribute('aria-busy');
            var status = element(view === 'desktop' ? 'div' : 'li', 'ib-menu-status');
            status.setAttribute('role', 'alert');
            status.setAttribute('data-menu-error', problem.menuCode);
            status.appendChild(element('span', '', (self.messages[problem.menuCode] || self.messages.loadError) + ' '));
            if (problem.menuCode === 'sessionExpired') {
                var destination = loginUrl(self.options.loginUrl);
                if (destination) {
                    var login = element('a', 'uk-button uk-button-small uk-button-default', self.messages.login);
                    login.href = destination.href;
                    login.setAttribute('data-menu-login', '');
                    status.appendChild(login);
                } else {
                    var reload = element('button', 'uk-button uk-button-small uk-button-default', self.messages.reload);
                    reload.type = 'button';
                    reload.setAttribute('data-menu-reload', '');
                    reload.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); window.location.reload(); });
                    status.appendChild(reload);
                }
            } else if (problem.retryable) {
                var retry = element('button', 'uk-button uk-button-small uk-button-default', self.messages.retry);
                retry.type = 'button';
                retry.setAttribute('data-menu-retry', item.id);
                retry.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); branch.load(); });
                status.appendChild(retry);
            }
            panel.replaceChildren(status);
            if (native) window.UIkit.update(panel);
        };

        branch.load = function () {
            if (self.sessionError) {
                branch.showError(self.sessionError);
                return Promise.resolve();
            }
            function revealActivePath() {
                if (view === 'sidebar' && branch.open && panel.isConnected && !branch.activePathOpened && self.options.openMobilePath !== false) {
                    branch.activePathOpened = true;
                    self.openActivePath(panel);
                }
            }
            if (branch.loaded) {
                if (native) window.requestAnimationFrame(revealActivePath);
                else revealActivePath();
                return Promise.resolve();
            }
            if (branch.pending) return branch.pending;
            panel.setAttribute('aria-busy', 'true');
            var status = element(view === 'desktop' ? 'div' : 'li', 'ib-menu-status', self.messages.loading);
            status.setAttribute('role', 'status');
            panel.replaceChildren(status);
            branch.pending = self.fetchChildren(item).then(function (items) {
                if (self.sessionError) throw self.sessionError;
                panel.replaceChildren();
                if (view === 'desktop') self.renderColumns(panel, items, item, depth + 1, skeleton);
                else items.forEach(function (child) { panel.appendChild(self.renderItem(child, view, depth + 1)); });
                branch.loaded = true;
                if (native) {
                    if (view === 'sidebar') self.nav(panel);
                    window.UIkit.update(panel);
                    window.requestAnimationFrame(function () {
                        var component = window.UIkit.getComponent(panel, 'drop') || window.UIkit.getComponent(panel, 'dropdown');
                        if (branch.open && component && panel.isConnected) component.position();
                    });
                }
                // Let UIkit refresh cached Nav targets before opening children.
                if (native) window.requestAnimationFrame(revealActivePath);
                else revealActivePath();
            }).catch(function (error) {
                branch.showError(error);
            }).finally(function () {
                panel.removeAttribute('aria-busy');
                branch.pending = null;
            });
            return branch.pending;
        };
        function component() {
            if (view === 'sidebar') return self.nav(li.parentElement);
            return window.UIkit.getComponent(panel, 'drop') || window.UIkit.getComponent(panel, 'dropdown') || self.dropdown(panel, dropdownMode, depth, navbar, !separateAction && !item.disabled);
        }
        function navIndex() {
            return Array.from(li.parentElement.children).filter(function (node) { return node.classList.contains('uk-parent'); }).indexOf(li);
        }
        branch.show = function () {
            if (item.disabled) return Promise.resolve();
            if (native) {
                branch.component = component();
                if (view === 'sidebar') {
                    if (!li.classList.contains('uk-open')) branch.component.toggle(navIndex(), false);
                } else if (!branch.component.isToggled()) {
                    if (separateAction) {
                        var reference = window.UIkit.getComponent(label, 'toggle') || { $el: positionTarget };
                        branch.component.show('target' in branch.component.$options.props ? positionTarget : reference, false);
                    } else branch.component.show();
                }
            } else {
                branch.open = true;
                toggle.setAttribute('aria-expanded', 'true');
                panel.hidden = false;
                li.classList.add('uk-open');
                if (view === 'desktop') panel.style.display = 'block';
            }
            return branch.load();
        };
        branch.close = function () {
            if (native) {
                branch.component = component();
                if (view === 'sidebar') {
                    if (li.classList.contains('uk-open')) branch.component.toggle(navIndex(), false);
                } else branch.component.hide(false);
            } else {
                branch.open = false;
                toggle.setAttribute('aria-expanded', 'false');
                li.classList.remove('uk-open');
                panel.hidden = true;
                panel.style.removeProperty('display');
            }
        };
        var eventTarget = view === 'desktop' ? panel : li;
        eventTarget.addEventListener('show', function (event) {
            if (event.target !== eventTarget) return;
            branch.open = true;
            toggle.setAttribute('aria-expanded', 'true');
            branch.load();
        });
        eventTarget.addEventListener('hide', function (event) {
            if (event.target !== eventTarget) return;
            branch.open = false;
            toggle.setAttribute('aria-expanded', 'false');
        });
        if (native) {
            if (view === 'sidebar') self.nav(panel);
            else if (depth || item.dropdownMode || item.disabled || separateAction)
                branch.component = self.dropdown(panel, dropdownMode, depth, navbar, !separateAction && !item.disabled);
            // Ordinary items use UIkit's native Toggle/Nav handlers, including
            // hover tracking and dismissal. A closed mobile parent opens first.
            if (view === 'sidebar' && !separateAction) label.addEventListener('click', function (event) {
                if (!branch.open) event.preventDefault();
            });
            if (view === 'desktop' && separateAction) toggle.addEventListener('click', function (event) {
                event.preventDefault();
                if (branch.open) branch.close();
                else branch.show();
            });
        } else {
            toggle.addEventListener('click', function (event) {
                if (item.disabled) return;
                if (branch.open && !separateAction && href && item.href !== '#') return;
                event.preventDefault();
                event.stopPropagation();
                if (branch.open) branch.close();
                else branch.show();
            });
        }
        toggle.addEventListener('keydown', function (event) {
            if (item.disabled || (event.key !== 'ArrowDown' && event.key !== 'ArrowRight')) return;
            event.preventDefault();
            event.stopPropagation();
            branch.show().then(function () {
                if (document.activeElement !== toggle) return;
                var first = panel.querySelector('a[href]:not([aria-disabled=true]),button:not([disabled])');
                if (first) first.focus();
            });
        });
        return li;
    };

    Menu.prototype.nav = function (list) {
        list.setAttribute('uk-nav', 'multiple: true');
        return window.UIkit.getComponent(list, 'nav') || window.UIkit.nav(list, {
            multiple: true, animation: false,
            toggle: '> .ib-menu-native-toggle, > [uk-lightbox] > .ib-menu-native-toggle',
        });
    };

    Menu.prototype.dropdown = function (panel, mode, depth, navbar, automatic) {
        var options = { mode: mode, toggle: automatic ? '- *' : false, pos: depth ? 'right-top' : 'bottom-left' };
        if (depth) return window.UIkit.dropdown(panel, options);
        var hasAxisBoundaries = 'boundaryX' in window.UIkit.component('drop').options.props;
        Object.assign(options, {
            clsDrop: 'uk-navbar-dropdown',
            flip: hasAxisBoundaries ? false : 'x', shift: true, autoUpdate: false,
            boundary: hasAxisBoundaries ? false : navbar || window,
            boundaryX: navbar || false,
        });
        return window.UIkit.drop(panel, options);
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
        var navbarDropdown = panel.classList.contains('uk-navbar-dropdown');
        var grid = element('div', 'uk-drop-grid ' + (navbarDropdown ? 'uk-navbar-dropdown-grid' : 'uk-dropdown-grid'));
        grid.setAttribute('uk-grid', '');
        var size = Math.max(1, Number(parent.childrenPerColumn) || 10);
        var columns = Math.max(1, Number(parent.fixedColumns) || Math.ceil(items.length / size));
        grid.classList.add('uk-child-width-1-' + Math.min(columns, 6));
        var start = 0;
        for (var part = 0; start < items.length; part++) {
            var count = parent.fixedColumns ? Math.floor(items.length / columns) + (part < items.length % columns ? 1 : 0) : size;
            var end = Math.min(start + count, items.length);
            var column = element('div');
            var list = element('ul', 'uk-nav ' + (navbarDropdown ? 'uk-navbar-dropdown-nav' : 'uk-dropdown-nav') + ' ib-menu-desktop');
            for (var index = start; index < end; index++) list.appendChild(this.renderItem(items[index], 'desktop', depth));
            column.appendChild(list);
            grid.appendChild(column);
            start = end;
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
                nav = element('nav', 'uk-navbar ' + (self.options.wrapClass || ''));
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
            var toggle = element('a', 'uk-navbar-toggle');
            toggle.id = this.prefix + '-hamburger';
            toggle.setAttribute('href', '#' + this.sidebarId);
            toggle.setAttribute('aria-label', this.messages.openMenu);
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-controls', this.sidebarId);
            toggle.setAttribute('uk-toggle', 'target: #' + this.sidebarId);
            toggle.setAttribute('data-menu-hamburger', '');
            var icon = element('span');
            icon.setAttribute('uk-navbar-toggle-icon', '');
            toggle.appendChild(icon);
            mobile.appendChild(toggle);
            nav.appendChild(mobile);
            this.mobile = mobile;
            // Create the target before UIkit's native toggle receives the click.
            toggle.addEventListener('click', function (event) {
                var firstOpen = !self.sidebar;
                self.createSidebar(toggle);
                if (window.UIkit && firstOpen) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    window.UIkit.toggle(toggle, { target: '#' + self.sidebarId }).toggle();
                } else if (!window.UIkit) {
                    event.preventDefault();
                    self.sidebar.classList.toggle('ib-menu-fallback-open');
                    toggle.setAttribute('aria-expanded', String(self.sidebar.classList.contains('ib-menu-fallback-open')));
                }
            });
        }
    };

    Menu.prototype.createSidebar = function (toggle) {
        var self = this;
        if (this.sidebar) return;
        this.sidebar = element('div', 'ib-menu-sidebar');
        this.sidebar.id = this.sidebarId;
        this.sidebar.setAttribute('uk-offcanvas', '');
        this.sidebar.setAttribute('aria-label', this.messages.openMenu);
        var bar = element('div', 'uk-offcanvas-bar');
        var close = element('button', 'uk-offcanvas-close');
        close.type = 'button';
        close.setAttribute('uk-close', '');
        close.setAttribute('aria-label', this.messages.closeMenu);
        bar.appendChild(close);
        this.sidebar.appendChild(bar);
        (this.payload.navbars || []).forEach(function (navbar) {
            var section = element('div', navbar.sidebarClasses || '');
            var logo = self.options.showLogo === false ? null : self.logo(navbar.logo);
            if (logo) section.appendChild(logo);
            var list = element('ul', 'uk-nav-default uk-text-left');
            list.setAttribute('uk-nav', 'multiple: true');
            (navbar.items || []).forEach(function (item) { list.appendChild(self.renderItem(item, 'sidebar', 0)); });
            if (window.UIkit) self.nav(list);
            section.appendChild(list);
            bar.appendChild(section);
        });
        this.sidebar.addEventListener('show', function (event) {
            if (event.target === self.sidebar) toggle.setAttribute('aria-expanded', 'true');
        });
        this.sidebar.addEventListener('hidden', function (event) {
            if (event.target === self.sidebar) toggle.setAttribute('aria-expanded', 'false');
        });
        this.sidebar.addEventListener('keydown', this.onKeydown, true);
        this.root.after(this.sidebar);
        if (window.UIkit) window.UIkit.offcanvas(this.sidebar, { container: false });
        else {
            close.addEventListener('click', function () {
                self.sidebar.classList.remove('ib-menu-fallback-open');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.focus();
            });
            this.sidebar.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && !event.defaultPrevented) close.click();
            });
        }
        this.openActivePath(this.sidebar);
    };

    Menu.prototype.openActivePath = function (scope) {
        if (this.options.openMobilePath === false) return;
        this.branches.filter(function (branch) {
            return branch.view === 'sidebar' && branch.containsActive && !branch.open && scope.contains(branch.li);
        }).forEach(function (branch) { branch.show(); });
    };

    // Traditional Blade menus already contain their descendants. Open the
    // highlighted ancestors once, when the user first opens the mobile panel.
    function initLegacySidebars(scope) {
        var legacySelector = '[data-ib-menu-offcanvas]';
        var sidebars = scope.matches && scope.matches(legacySelector) ? [scope] : [];
        if (scope.querySelectorAll) sidebars = sidebars.concat(Array.from(scope.querySelectorAll(legacySelector)));
        sidebars.forEach(function (sidebar) {
            if (legacySidebars.has(sidebar)) return;
            legacySidebars.add(sidebar);
            var opened = false;
            sidebar.addEventListener('beforeshow', function (event) {
                if (event.target !== sidebar || opened || sidebar.getAttribute('data-menu-open-active-path') === 'false') return;
                opened = true;
                sidebar.querySelectorAll('.uk-parent.uk-active').forEach(function (li) {
                    if (!li.querySelector('.uk-nav-sub .uk-active') || li.classList.contains('uk-open')) return;
                    var label = li.querySelector('a');
                    if (label && label.getAttribute('aria-disabled') === 'true') return;
                    var list = li.parentElement;
                    if (window.UIkit) {
                        var nav = window.UIkit.getComponent(list, 'nav') || window.UIkit.nav(list, { multiple: true, animation: false });
                        var index = Array.from(list.children).filter(function (node) { return node.classList.contains('uk-parent'); }).indexOf(li);
                        nav.toggle(index, false);
                    } else li.classList.add('uk-open');
                    if (label) label.setAttribute('aria-expanded', 'true');
                });
            });
        });
    }

    function init(scope) {
        initLegacySidebars(scope);
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
                    if (!window.UIkit && branch.view === 'desktop' && branch.open && !branch.li.contains(event.target)) branch.close();
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
