/* Run with node --test tests/js/progressive-menu.test.cjs (requires Playwright + Chrome).
 * Set UIKIT_JS_PATH (and optionally UIKIT_CSS_PATH) to verify an application's UIkit bundle.
 * MENU_JS_PATH can point to a compiled Webpack bundle containing the renderer. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

let browser;
before(async () => {
    browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, headless: true } : { channel: 'chrome', headless: true });
});
after(async () => { if (browser) await browser.close(); });

const script = process.env.MENU_JS_PATH || path.resolve(__dirname, '../../resources/assets/js/progressive-menu.js');
const branch = { id: 'clients', name: 'clients', text: 'Clients', href: '/clients', hasChildren: true, childrenUrl: '/menu/children/clients', childrenPerColumn: 2 };
const child = withHtml({ id: 'active', name: 'active', text: 'Active clients', href: '/clients/active', hasChildren: true, childrenUrl: '/menu/children/active' });
const payload = {
    version: 1,
    options: { offcanvas: true, offcanvasId: 'menu-container-fixture', dropdownMode: 'click', offcanvasButtonHtml: '<a href="#" class="ib-button" uk-toggle="target: #menu-container-fixture"><i class="fa-solid fa-bars"></i></a>' },
    navbars: [{ id: 'main', orientation: 'horizontal', classes: 'uk-navbar-left', items: [branch, { id: 'home', text: 'Home', href: '/' }] }]
};

// Scalar fixtures mirror the default Button Blade shell. The optional PHP
// fixture below additionally compares the renderer against real Blade output.
function withHtml(item) {
    if (item.html) return item;
    const anchor = '<a href="' + (item.href || '#') + '" class="' + (item.classes || '') + '"' + (item.disabled ? ' disabled' : '') + '>' +
        (item.image ? '<img src="' + item.image + '" style="max-width:45px">' : '') + item.text +
        (item.hasChildren ? '<span uk-nav-parent-icon></span>' : '') + '</a>';
    return { ...item, html: {
        desktop: '<li class="' + (item.hasChildren ? 'ib-navbar-dropdown-parent ' : '') + (item.name || item.id) + '">' + anchor +
            (item.hasChildren ? '<div class="uk-navbar-dropdown uk-width-auto"><div class="uk-navbar-dropdown-grid uk-child-width-1-1" uk-grid><div><ul class="uk-nav uk-navbar-dropdown-nav"></ul></div></div></div>' : '') + '</li>',
        sidebar: '<li class="' + (item.active ? 'uk-active ' : '') + (item.hasChildren ? 'uk-parent' : '') + '">' + anchor +
            (item.hasChildren ? '<ul class="uk-nav-sub"></ul>' : '') + '</li>'
    } };
}

async function fixture(data = payload, useUIKit = false) {
    data = structuredClone(data);
    data.navbars.forEach(navbar => { navbar.items = navbar.items.map(withHtml); });
    const page = await browser.newPage();
    await page.route('http://menu.test/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }));
    await page.goto('http://menu.test/');
    await page.evaluate(data => {
        const root = document.createElement('div');
        root.setAttribute('data-ib-progressive-menu', '');
        const script = document.createElement('script');
        script.type = 'application/json';
        script.setAttribute('data-menu-payload', '');
        script.textContent = JSON.stringify(data);
        root.append(script, document.createElement('div'));
        root.lastChild.setAttribute('data-menu-primary', '');
        document.body.append(root);
    }, data);
    if (useUIKit) {
        if (process.env.UIKIT_CSS_PATH) await page.addStyleTag({ path: process.env.UIKIT_CSS_PATH });
        await page.addScriptTag({ path: process.env.UIKIT_JS_PATH });
    }
    await page.addScriptTag({ path: script });
    return page;
}

async function click(page, selector) {
    await page.locator(selector).evaluate(node => node.click());
}
const desktop = id => '[data-menu-primary] [data-menu-expand="' + id + '"]';
const sidebar = id => '.ib-menu-sidebar [data-menu-expand="' + id + '"]';

test('initial render is roots only; sidebar creates no requests; links remain navigable', async () => {
    const page = await fixture();
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    assert.equal(await page.locator('[data-menu-item]').count(), 2);
    assert.equal(await page.locator('.ib-menu-sidebar').count(), 0);
    assert.equal(await page.locator('[data-menu-item=clients]>a').getAttribute('href'), '/clients');
    assert.equal(await page.locator('[data-menu-children=clients]').textContent(), '');
    await click(page, '[data-menu-hamburger]');
    assert.equal(await page.locator('.ib-menu-sidebar').count(), 1);
    assert.equal(await page.locator('.ib-menu-sidebar [data-menu-item]').count(), 2);
    assert.deepEqual(requests, []);
    const ids = await page.locator('[id]').evaluateAll(nodes => nodes.map(node => node.id));
    assert.equal(new Set(ids).size, ids.length);
    await page.close();
});

test('desktop and sidebar deduplicate pending requests and retain resolved branches', async () => {
    const page = await fixture();
    let requests = 0;
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/menu/children/clients', async route => {
        requests++;
        assert.equal(route.request().headers().accept, 'application/json');
        await gate;
        await route.fulfill({ json: { id: 'clients', items: [child] } });
    });
    await click(page, desktop('clients'));
    await click(page, '[data-menu-hamburger]');
    await click(page, sidebar('clients'));
    await page.waitForFunction(() => document.querySelectorAll('[aria-busy=true]').length === 2);
    release();
    await page.waitForFunction(() => document.querySelectorAll('[data-menu-item=active]').length === 2);
    assert.equal(requests, 1);
    assert.equal(await page.locator('[data-menu-children=active]').first().textContent(), '');
    await click(page, desktop('clients'));
    await click(page, desktop('clients'));
    assert.equal(requests, 1);
    await page.close();
});

test('failed and HTML responses can retry, with no cached failure', async () => {
    const page = await fixture();
    let requests = 0;
    await page.route('**/menu/children/clients', route => {
        requests++;
        return requests === 1 ? route.fulfill({ contentType: 'text/html', body: '<html>Sign in</html>' }) : route.fulfill({ json: { items: [child] } });
    });
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-retry=clients]');
    await click(page, '[data-menu-retry=clients]');
    await page.waitForSelector('[data-menu-item=active]');
    assert.equal(requests, 2);
    await page.close();
});

test('closing while request is pending does not reopen or duplicate descendants', async () => {
    const page = await fixture();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/menu/children/clients', async route => { await gate; await route.fulfill({ json: { items: [child] } }); });
    await click(page, desktop('clients'));
    await click(page, desktop('clients'));
    release();
    await page.waitForFunction(() => document.querySelector('[data-menu-item=active]'));
    assert.equal(await page.locator(desktop('clients')).getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('[data-menu-children=clients]').isVisible(), false);
    await click(page, desktop('clients'));
    assert.equal(await page.locator('[data-menu-item=active]').count(), 1);
    await page.close();
});

test('nested show events do not load ancestors; nested children fetch only when expanded', async () => {
    const page = await fixture();
    const requests = [];
    await page.route('**/menu/children/**', route => {
        const id = route.request().url().split('/').pop();
        requests.push(id);
        return route.fulfill({ json: { items: id === 'clients' ? [child] : [withHtml({ id: 'detail', text: 'Detail', href: '/detail' })] } });
    });
    await click(page, desktop('clients'));
    await page.waitForSelector(desktop('active'), { state: 'attached' });
    assert.deepEqual(requests, ['clients']);
    await click(page, desktop('active'));
    await page.waitForSelector('[data-menu-item=detail]');
    await page.locator('[data-menu-children=active]').evaluate(node => node.dispatchEvent(new Event('show', { bubbles: true })));
    assert.deepEqual(requests, ['clients', 'active']);
    await page.close();
});

test('AJAX inserted roots initialize once; dangerous URLs are removed and disabled items cannot expand', async () => {
    const data = structuredClone(payload);
    data.navbars[0].items.push({ id: 'unsafe', text: '<strong>Label</strong>', href: 'javascript:alert(1)', image: 'javascript:alert(1)' });
    data.navbars[0].items[0].disabled = true;
    const page = await fixture(data);
    await page.evaluate(() => {
        const old = document.querySelector('[data-ib-progressive-menu]');
        const root = document.createElement('div');
        root.setAttribute('data-ib-progressive-menu', '');
        root.appendChild(old.querySelector('script').cloneNode(true));
        document.body.appendChild(root);
    });
    await page.waitForFunction(() => document.querySelectorAll('[data-menu-item=home]').length === 2);
    await page.addScriptTag({ path: script });
    assert.equal(await page.locator('[data-menu-item=home]').count(), 2);
    assert.equal(await page.locator('[data-menu-item=unsafe] a[href],[data-menu-item=unsafe] img').count(), 0);
    assert.equal(await page.locator('[data-menu-item=unsafe] strong').count(), 2);
    assert.equal(await page.locator(desktop('clients')).first().getAttribute('aria-disabled'), 'true');
    const targets = await page.locator('[data-menu-hamburger]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-controls')));
    assert.equal(new Set(targets).size, targets.length);
    await page.close();
});

test('actual UIkit supports lazy dropdowns and sidebar without taking over parent links', { skip: !process.env.UIKIT_JS_PATH }, async () => {
    const page = await fixture(payload, true);
    let requests = 0;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/menu/children/clients', route => { requests++; return route.fulfill({ json: { items: [child] } }); });
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-item=active]');
    await page.waitForFunction(() => document.querySelector('[data-menu-children=clients]').classList.contains('uk-open'));
    assert.equal(await page.locator('[data-menu-primary] [data-menu-children=clients]').isVisible(), true);
    assert.equal(await page.locator(desktop('clients')).getAttribute('aria-expanded'), 'true');
    await click(page, desktop('clients'));
    assert.equal(await page.locator(desktop('clients')).getAttribute('aria-expanded'), 'false');
    await page.waitForFunction(() => !document.querySelector('[data-menu-children=clients]').classList.contains('uk-open'));
    await click(page, '[data-menu-hamburger]');
    await click(page, sidebar('clients'));
    await page.waitForFunction(() => document.querySelectorAll('[data-menu-item=active]').length === 2);
    assert.equal(await page.locator('[data-menu-item=clients]>a').first().getAttribute('href'), '/clients');
    assert.equal(requests, 1);
    assert.deepEqual(errors, []);
    await page.close();
});

test('keyboard opens and focuses a branch; Escape collapses it without closing the sidebar', async () => {
    const page = await fixture();
    await page.route('**/menu/children/clients', route => route.fulfill({ json: { items: [withHtml({ id: 'detail', href: '/detail', text: 'Detail' })] } }));
    await click(page, '[data-menu-hamburger]');
    await page.locator(sidebar('clients')).focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement.closest('[data-menu-item=detail]'));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator(sidebar('clients')).getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('[data-menu-hamburger]').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator(sidebar('clients')).evaluate(node => node === document.activeElement), true);
    await page.close();
});

test('removing an AJAX menu also removes its legacy sibling hamburger and sidebar', async () => {
    const page = await fixture();
    await click(page, '[data-menu-hamburger]');
    await page.locator('[data-ib-progressive-menu]').evaluate(root => root.remove());
    await page.waitForFunction(() => !document.querySelector('[data-menu-hamburger],.ib-menu-sidebar'));
    assert.equal(await page.locator('[data-menu-hamburger],.ib-menu-sidebar').count(), 0);
    await page.close();
});

test('UIkit hover opens only the hovered branch; close during download stays closed', { skip: !process.env.UIKIT_JS_PATH }, async () => {
    const data = structuredClone(payload);
    data.options.dropdownMode = 'hover';
    data.navbars[0].items.push({ ...branch, id: 'click-only', dropdownMode: 'click' });
    const page = await fixture(data, true);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/menu/children/clients', async route => { await gate; await route.fulfill({ json: { items: [child] } }); });
    // Move outside the navbar to release UIkit's initial-pointer guard.
    await page.mouse.move(1, 1);
    await page.locator('[data-menu-item=click-only]').dispatchEvent('pointerenter', { pointerType: 'mouse' });
    assert.equal(await page.locator(desktop('click-only')).getAttribute('aria-expanded'), 'false');
    await page.locator('[data-menu-item=clients]').dispatchEvent('pointerenter', { pointerType: 'mouse' });
    await page.waitForFunction(() => document.querySelector('[data-menu-children=clients]').classList.contains('uk-open'));
    await click(page, desktop('clients'));
    release();
    await page.waitForFunction(() => document.querySelector('[data-menu-item=active]'));
    await page.waitForFunction(() => !document.querySelector('[data-menu-children=clients]').classList.contains('uk-open'));
    assert.equal(await page.locator(desktop('clients')).getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('[data-menu-children=active]').textContent(), '');
    await page.close();
});

test('progressive desktop and mobile DOM preserve real Blade structure, classes and columns', { skip: !process.env.MENU_HTML_FIXTURE_PATH }, async () => {
    const contracts = JSON.parse(fs.readFileSync(process.env.MENU_HTML_FIXTURE_PATH, 'utf8'));
    for (const contract of contracts) {
        const branches = new Map();
        const localize = item => {
            if (item.childrenUrl) item.childrenUrl = new URL(item.childrenUrl).pathname;
            return item;
        };
        contract.payload.navbars.forEach(navbar => navbar.items.forEach(localize));
        Object.entries(contract.branches).forEach(([url, response]) => {
            response.items.forEach(localize);
            branches.set(new URL(url).pathname, response);
        });
        const page = await fixture(contract.payload);
        await page.route('**/il-bronza/menu/items/**', route => route.fulfill({ json: branches.get(new URL(route.request().url()).pathname) }));
        await click(page, '[data-menu-hamburger]');
        // Each branch is also opened in the sidebar, exercising shared data.
        const loaded = new Set();
        while (true) {
            const ids = await page.locator('[data-menu-primary] [data-menu-expand]').evaluateAll(nodes => nodes.map(node => node.dataset.menuExpand));
            const id = ids.find(id => !loaded.has(id));
            if (!id) break;
            await click(page, desktop(id));
            await page.waitForFunction(id => {
                const panel = document.querySelector('[data-menu-primary] [data-menu-children="' + id + '"]');
                return panel.children.length && !panel.hasAttribute('aria-busy');
            }, id);
            await click(page, sidebar(id));
            await page.waitForFunction(id => {
                const panel = document.querySelector('.ib-menu-sidebar [data-menu-children="' + id + '"]');
                return panel.children.length && !panel.hasAttribute('aria-busy');
            }, id);
            loaded.add(id);
        }
        const shapes = await page.evaluate(legacyHtml => {
            const attributes = ['class', 'style', 'href', 'target', 'disabled', 'uk-grid', 'uk-navbar', 'uk-nav', 'uk-sticky', 'uk-offcanvas', 'uk-dropdown', 'uk-lightbox', 'uk-close', 'uk-nav-parent-icon', 'data-type'];
            function shape(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.replace(/\s+/g, ' ').trim();
                    return text ? ['text', text] : null;
                }
                if (node.nodeType !== Node.ELEMENT_NODE || node.matches('script,noscript')) return null;
                const attrs = {};
                attributes.forEach(name => {
                    if (!node.hasAttribute(name)) return;
                    let value = node.getAttribute(name);
                    if (name === 'class') {
                        value = Array.from(new Set(value.split(/\s+/).filter(name => name && !name.startsWith('ib-menu-') && name !== 'uk-open'))).sort().join(' ');
                        if (!value) return;
                    }
                    if (name === 'href' && (value === '#' || value === 'javascript:void(0)')) return;
                    if (name === 'style') {
                        const style = node.cloneNode(false).style;
                        style.removeProperty('display');
                        value = style.cssText;
                        if (!value) return;
                    }
                    attrs[name] = value;
                });
                return [node.tagName.toLowerCase(), attrs, Array.from(node.childNodes).map(shape).filter(Boolean)];
            }
            const legacy = new DOMParser().parseFromString(legacyHtml, 'text/html');
            return {
                legacy: Array.from(legacy.body.childNodes).map(shape).filter(Boolean),
                progressive: Array.from(document.body.childNodes).map(shape).filter(Boolean)
            };
        }, contract.legacyHtml);
        assert.deepEqual(shapes.progressive, shapes.legacy);
        await page.close();
    }
});

test('UIkit applies the same navbar link styling to progressive and traditional Blade HTML', { skip: !process.env.MENU_HTML_FIXTURE_PATH || !process.env.UIKIT_CSS_PATH || !process.env.UIKIT_JS_PATH }, async () => {
    const contract = JSON.parse(fs.readFileSync(process.env.MENU_HTML_FIXTURE_PATH, 'utf8'))[0];
    const page = await fixture(contract.payload, true);
    await page.evaluate(html => {
        const reference = document.createElement('section');
        reference.id = 'legacy-reference';
        reference.innerHTML = html;
        document.body.appendChild(reference);
    }, contract.legacyHtml);
    const styles = await page.evaluate(() => {
        const properties = ['display', 'alignItems', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'textTransform', 'minHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'color'];
        const style = selector => {
            const computed = getComputedStyle(document.querySelector(selector));
            return Object.fromEntries(properties.map(name => [name, computed[name]]));
        };
        return {
            progressive: style('[data-menu-primary] .uk-navbar-nav > li > a'),
            legacy: style('#legacy-reference .uk-navbar-nav > li > a')
        };
    });
    assert.deepEqual(styles.progressive, styles.legacy);
    await page.close();
});

test('opened progressive dropdowns keep native widths and link alignment at every level', { skip: !process.env.MENU_HTML_FIXTURE_PATH || !process.env.UIKIT_CSS_PATH || !process.env.UIKIT_JS_PATH }, async () => {
    const contracts = JSON.parse(fs.readFileSync(process.env.MENU_HTML_FIXTURE_PATH, 'utf8'));
    assert.equal(contracts.length, 3, 'Re-export the PHP fixture to include explicit dropdown widths.');
    for (const contract of [contracts[0], contracts[2]]) {
        const branches = new Map();
        const localize = item => {
            if (item.childrenUrl) item.childrenUrl = new URL(item.childrenUrl).pathname;
            return item;
        };
        contract.payload.navbars.forEach(navbar => navbar.items.forEach(localize));
        Object.entries(contract.branches).forEach(([url, response]) => {
            response.items.forEach(localize);
            branches.set(new URL(url).pathname, response);
        });
        const root = contract.payload.navbars[0].items[0];
        const nested = branches.get(root.childrenUrl).items[0];
        const page = await fixture(contract.payload, true);
        await page.route('**/il-bronza/menu/items/**', route => route.fulfill({ json: branches.get(new URL(route.request().url()).pathname) }));
        await page.evaluate(html => {
            const reference = document.createElement('section');
            reference.id = 'legacy-reference';
            reference.innerHTML = html;
            document.body.appendChild(reference);
        }, contract.legacyHtml);
        const measure = async selector => page.locator(selector).first().evaluate(panel => {
            const styles = getComputedStyle(panel);
            const rect = panel.getBoundingClientRect();
            const link = panel.previousElementSibling;
            return {
                genericDropdown: panel.classList.contains('uk-dropdown'),
                width: Math.round(rect.width),
                minWidth: styles.minWidth,
                paddingLeft: styles.paddingLeft,
                paddingRight: styles.paddingRight,
                linkOffset: Math.round(rect.left - link.getBoundingClientRect().left)
            };
        });
        const openLegacy = async selector => {
            await page.waitForFunction(selector => {
                const panel = document.querySelector(selector);
                return !!(UIkit.getComponent(panel, 'drop') || UIkit.getComponent(panel, 'dropdown'));
            }, selector);
            await page.locator(selector).first().evaluate(panel => {
                const component = UIkit.getComponent(panel, 'drop') || UIkit.getComponent(panel, 'dropdown');
                const link = panel.previousElementSibling;
                component.show('target' in component.$options.props ? link : { $el: link }, false);
            });
            await page.waitForFunction(selector => document.querySelector(selector).classList.contains('uk-open'), selector);
        };
        const openProgressive = async item => {
            await click(page, desktop(item.id));
            const selector = '[data-menu-primary] [data-menu-children="' + item.id + '"]';
            await page.waitForFunction(selector => {
                const panel = document.querySelector(selector);
                return panel.classList.contains('uk-open') && !panel.hasAttribute('aria-busy') && panel.querySelector('.uk-nav > li');
            }, selector);
            return selector;
        };
        for (const viewportWidth of [1280, 1024]) {
            await page.setViewportSize({ width: viewportWidth, height: 1000 });
            const progressiveRoot = await openProgressive(root);
            await page.waitForTimeout(300);
            const progressiveRootSize = await measure(progressiveRoot);
            const progressiveNested = await openProgressive(nested);
            await page.waitForTimeout(300);
            const progressiveNestedSize = await measure(progressiveNested);
            const legacyRoot = '#legacy-reference .uk-navbar-dropdown';
            await openLegacy(legacyRoot);
            await page.waitForTimeout(300);
            const legacyRootSize = await measure(legacyRoot);
            const legacyNested = '#legacy-reference .uk-navbar-dropdown .uk-dropdown';
            await openLegacy(legacyNested);
            await page.waitForTimeout(300);
            const legacyNestedSize = await measure(legacyNested);
            assert.deepEqual(progressiveRootSize, legacyRootSize, 'Navbar dropdown at ' + viewportWidth + 'px');
            assert.deepEqual(progressiveNestedSize, legacyNestedSize, 'Nested dropdown at ' + viewportWidth + 'px');
        }
        await page.close();
    }
});
