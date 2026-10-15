/* Run with node --test tests/js/progressive-menu.test.cjs (requires Playwright + Chrome).
 * Set UIKIT_JS_PATH (and optionally UIKIT_CSS_PATH) to verify an application's UIkit bundle.
 * MENU_JS_PATH can point to a compiled Webpack bundle containing the renderer. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { chromium } = require('playwright');

let browser;
before(async () => {
    browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, headless: true } : { channel: 'chrome', headless: true });
});
after(async () => { if (browser) await browser.close(); });

const script = process.env.MENU_JS_PATH || path.resolve(__dirname, '../../resources/assets/js/progressive-menu.js');
const branch = { id: 'clients', name: 'clients', text: 'Clients', href: '#', hasChildren: true, childrenUrl: '/menu/children/clients', childrenPerColumn: 2 };
const child = withHtml({ id: 'active', name: 'active', isChild: true, text: 'Active clients', href: '#', hasChildren: true, childrenUrl: '/menu/children/active' });
const payload = {
    version: 1,
    options: { offcanvas: true, offcanvasId: 'menu-container-fixture', dropdownMode: 'click', offcanvasButtonHtml: '<a href="#" class="ib-button" uk-toggle="target: #menu-container-fixture"><i class="fa-solid fa-bars"></i></a>' },
    navbars: [{ id: 'main', orientation: 'horizontal', classes: 'uk-navbar-left', items: [branch, { id: 'home', text: 'Home', href: '/' }] }]
};

// Scalar fixtures mirror the default Button Blade shell. The optional PHP
// fixture below additionally compares the renderer against real Blade output.
function withHtml(item) {
    if (item.html) return item;
    const anchor = '<a href="' + (item.href || '#') + '" class="' + (item.classes || '') + '"' + (item.disabled ? ' disabled' : '') + (item.toggle ? ' uk-toggle="target: ' + item.toggle + '"' : '') + '>' +
        (item.image ? '<img src="' + item.image + '" style="max-width:45px">' : '') + item.text +
        (item.hasChildren ? '<span ' + (item.isChild ? 'uk-drop-parent-icon' : 'uk-navbar-parent-icon') + '></span>' : '') + '</a>';
    return { ...item, html: {
        desktop: '<li class="' + (item.hasChildren ? 'ib-navbar-dropdown-parent ' : '') + (item.name || item.id) + '">' + anchor +
            (item.hasChildren ? '<div class="' + (item.isChild ? 'uk-dropdown' : 'uk-navbar-dropdown') + '"' + (item.isChild ? ' uk-dropdown="mode: click; pos: right-top"' : '') + '><div class="uk-drop-grid uk-navbar-dropdown-grid uk-child-width-1-1" uk-grid><div><ul class="uk-nav uk-navbar-dropdown-nav"></ul></div></div></div>' : '') + '</li>',
        sidebar: '<li class="' + (item.active ? 'uk-active ' : '') + (item.hasChildren ? 'uk-parent' : '') + '">' + anchor +
            (item.hasChildren ? '<ul class="uk-nav-sub" uk-nav="multiple: true"></ul>' : '') + '</li>'
    } };
}

async function fixture(data = payload, useUIKit = false, existingPage, pageUrl = 'http://menu.test/') {
    data = structuredClone(data);
    data.navbars.forEach(navbar => { navbar.items = navbar.items.map(withHtml); });
    const page = existingPage || await browser.newPage();
    if (!existingPage && pageUrl === 'http://menu.test/') await page.route(pageUrl, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }));
    await page.goto(pageUrl);
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

function cachedPayload(scope = '1'.repeat(64), revision = 'a'.repeat(64)) {
    const data = structuredClone(payload);
    data.activeState = { items: [], ancestors: [] };
    data.browserCache = { enabled: true, key: scope, ttlSeconds: 300, maxEntries: 50 };
    data.navbars[0].items[0].childrenCacheKey = revision;
    return data;
}

test('session cache survives navigation and uses the new page highlighting', async () => {
    const data = cachedPayload();
    data.activeState.items = ['active'];
    const page = await fixture(data);
    let requests = 0;
    await page.route('**/menu/children/clients', route => {
        requests++;
        return route.fulfill({ json: { id: 'clients', items: [withHtml({ id: 'active', text: 'Clients page', href: '/clients', active: true })] } });
    });
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-item=active] > a[aria-current=page]');
    data.activeState.items = ['home'];
    await fixture(data, false, page);
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-item=active]');
    assert.equal(requests, 1);
    assert.equal(await page.locator('[data-menu-item=active] > a').getAttribute('aria-current'), null);
    assert.equal(await page.locator('[data-menu-item=active]').getAttribute('class').then(value => value.includes('uk-active')), false);
    assert.equal(await page.locator('[data-menu-item=home] > a').getAttribute('aria-current'), 'page');
    await click(page, '[data-menu-hamburger]');
    await click(page, sidebar('clients'));
    await page.waitForSelector('.ib-menu-sidebar [data-menu-item=active]');
    assert.equal(requests, 1);
    await page.close();
});

test('session cache misses after a branch revision or user context change', async () => {
    const data = cachedPayload();
    const page = await fixture(data);
    let requests = 0;
    await page.route('**/menu/children/clients', route => {
        requests++;
        return route.fulfill({ json: { items: [withHtml({ id: 'leaf', text: 'Version ' + requests, href: '/leaf' })] } });
    });
    for (const [scope, revision] of [['1', 'a'], ['1', 'b'], ['2', 'b']]) {
        const next = cachedPayload(scope.repeat(64), revision.repeat(64));
        if (requests) await fixture(next, false, page);
        await click(page, desktop('clients'));
        await page.waitForSelector('[data-menu-item=leaf]');
    }
    assert.equal(requests, 3);
    assert.equal(await page.locator('[data-menu-item=leaf]').textContent(), 'Version 3');
    await page.close();
});

test('a late response cannot restore the previous user context in session storage', async () => {
    const page = await fixture(cachedPayload());
    let requests = 0;
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/menu/children/clients', async route => {
        const number = ++requests;
        if (number === 1) await gate;
        await route.fulfill({ json: { items: [withHtml({ id: 'leaf', text: number === 1 ? 'Previous context' : 'Current context', href: '/leaf' })] } });
    });
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-children=clients][aria-busy=true]');
    const previousPanel = await page.locator('[data-menu-children=clients]').elementHandle();
    const next = cachedPayload('2'.repeat(64));
    next.navbars.forEach(navbar => { navbar.items = navbar.items.map(withHtml); });
    await page.evaluate(data => {
        document.querySelector('[data-ib-progressive-menu]').remove();
        const root = document.createElement('div');
        root.setAttribute('data-ib-progressive-menu', '');
        const script = document.createElement('script');
        script.type = 'application/json';
        script.setAttribute('data-menu-payload', '');
        script.textContent = JSON.stringify(data);
        root.appendChild(script);
        document.body.appendChild(root);
    }, next);
    await page.waitForSelector(desktop('clients'));
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-item=leaf]');
    release();
    await page.waitForFunction(panel => !panel.hasAttribute('aria-busy'), previousPanel);
    await fixture(next, false, page);
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-item=leaf]');
    assert.equal(requests, 2);
    assert.equal(await page.locator('[data-menu-item=leaf]').textContent(), 'Current context');
    await page.close();
});

test('session cache expires without extending its lifetime on reads', async () => {
    const data = cachedPayload();
    const page = await fixture(data);
    let requests = 0;
    await page.route('**/menu/children/clients', route => { requests++; return route.fulfill({ json: { items: [child] } }); });
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-item=active]');
    await page.addInitScript(() => {
        const realNow = Date.now;
        Date.now = () => realNow() + 301000;
    });
    await fixture(data, false, page);
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-item=active]');
    assert.equal(requests, 2);
    await page.close();
});

for (const failure of ['blocked', 'full', 'corrupt', 'invalid-items']) {
    test('unavailable or corrupt session storage falls back to normal requests: ' + failure, async () => {
        const data = cachedPayload();
        const page = await fixture(data);
        let requests = 0;
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/menu/children/clients', route => { requests++; return route.fulfill({ json: { items: [child] } }); });
        await click(page, desktop('clients'));
        await page.waitForSelector('[data-menu-item=active]');
        if (failure === 'corrupt') await page.evaluate(() => sessionStorage.setItem('ib-menu-branches:v1', '{broken JSON'));
        else if (failure === 'invalid-items') {
            await page.evaluate(() => {
                const data = JSON.parse(sessionStorage.getItem('ib-menu-branches:v1'));
                Object.values(data.entries)[0].items = [{ id: 'broken' }];
                sessionStorage.setItem('ib-menu-branches:v1', JSON.stringify(data));
            });
        }
        else {
            await page.addInitScript(failure => {
                if (failure === 'blocked') Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
                Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
            }, failure);
            await page.evaluate(() => sessionStorage.clear());
        }
        await fixture(data, false, page);
        await click(page, desktop('clients'));
        await page.waitForSelector('[data-menu-item=active]');
        assert.equal(requests, 2);
        assert.deepEqual(errors, []);
        await page.close();
    });
}

test('failed downloads do not persist and disabling cache removes stored branches', async () => {
    const data = cachedPayload();
    const page = await fixture(data);
    let requests = 0;
    await page.route('**/menu/children/clients', route => {
        requests++;
        return requests === 1 ? route.fulfill({ status: 500, json: { message: 'Failure' } }) : route.fulfill({ json: { items: [child] } });
    });
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-retry=clients]');
    await fixture(data, false, page);
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-item=active]');
    assert.equal(requests, 2);
    data.browserCache = { enabled: false };
    await fixture(data, false, page);
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-item=active]');
    assert.equal(requests, 3);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('ib-menu-branches:v1')), null);
    await page.close();
});

test('retry discards a stored fragment that can no longer be rendered', async () => {
    const data = cachedPayload();
    const page = await fixture(data);
    let requests = 0;
    await page.route('**/menu/children/clients', route => { requests++; return route.fulfill({ json: { items: [child] } }); });
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-item=active]');
    await page.evaluate(() => {
        const saved = JSON.parse(sessionStorage.getItem('ib-menu-branches:v1'));
        Object.values(saved.entries)[0].items[0].html.desktop = '';
        sessionStorage.setItem('ib-menu-branches:v1', JSON.stringify(saved));
    });
    await fixture(data, false, page);
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-retry=clients]');
    assert.equal(requests, 1);
    await click(page, '[data-menu-retry=clients]');
    await page.waitForSelector('[data-menu-item=active]');
    assert.equal(requests, 2);
    await page.close();
});

test('session cache bounds the number of stored branches', async () => {
    const data = cachedPayload();
    data.browserCache.maxEntries = 2;
    data.navbars[0].items = ['first', 'second', 'third'].map(id => ({ ...branch, id, childrenUrl: '/menu/children/' + id, childrenCacheKey: 'a'.repeat(64) }));
    const page = await fixture(data);
    const requests = [];
    await page.route('**/menu/children/**', route => {
        const id = route.request().url().split('/').pop();
        requests.push(id);
        return route.fulfill({ json: { items: [withHtml({ id: id + '-leaf', text: id, href: '/' + id })] } });
    });
    for (const id of ['first', 'second', 'third']) {
        await click(page, desktop(id));
        await page.waitForSelector('[data-menu-item=' + id + '-leaf]');
    }
    await fixture(data, false, page);
    await click(page, desktop('second'));
    await page.waitForSelector('[data-menu-item=second-leaf]');
    await click(page, desktop('first'));
    await page.waitForSelector('[data-menu-item=first-leaf]');
    assert.deepEqual(requests, ['first', 'second', 'third', 'first']);
    await page.close();
});

test('initial render is roots only; sidebar creates no requests; links remain navigable', async () => {
    const page = await fixture();
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    assert.equal(await page.locator('[data-menu-item]').count(), 2);
    assert.equal(await page.locator('.ib-menu-sidebar').count(), 0);
    assert.equal(await page.locator('[data-menu-item=home]>a').getAttribute('href'), '/');
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

test('network failures show a connection message and retry with a fresh request', async () => {
    const page = await fixture();
    let requests = 0;
    await page.route('**/menu/children/clients', route => {
        requests++;
        return requests === 1 ? route.abort('failed') : route.fulfill({ json: { items: [child] } });
    });
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-error=networkError][role=alert]');
    assert.match(await page.locator('[data-menu-error=networkError]').textContent(), /Connection problem/);
    await click(page, '[data-menu-retry=clients]');
    await page.waitForSelector('[data-menu-item=active]');
    assert.equal(requests, 2);
    await page.close();
});

for (const [status, code] of [[403, 'accessDenied'], [404, 'branchUnavailable'], [410, 'branchUnavailable']]) {
    test('terminal HTTP error ' + status + ' has a specific message without retry', async () => {
        const data = cachedPayload();
        const page = await fixture(data);
        let requests = 0;
        await page.route('**/menu/children/clients', route => {
            requests++;
            return route.fulfill({ status, json: { message: 'Do not display raw server details' } });
        });
        await click(page, desktop('clients'));
        await page.waitForSelector('[data-menu-error=' + code + '][role=alert]');
        assert.equal(await page.locator('[data-menu-retry]').count(), 0);
        assert.equal(await page.locator('[data-menu-login]').count(), 0);
        assert.doesNotMatch(await page.locator('[data-menu-error]').textContent(), /raw server details/);
        // Failures remain outside the persistent branch cache.
        await fixture(data, false, page);
        await click(page, desktop('clients'));
        await page.waitForSelector('[data-menu-error=' + code + ']');
        assert.equal(requests, 2);
        await page.close();
    });
}

for (const status of [401, 419]) {
    test('expired session ' + status + ' clears saved branches and offers login or reload', async () => {
        const data = cachedPayload();
        if (status === 401) data.options.loginUrl = '/sign-in';
        data.navbars[0].items.push({ ...branch, id: 'tools', childrenUrl: '/menu/children/tools', childrenCacheKey: 'b'.repeat(64) });
        const page = await fixture(data);
        let requests = 0;
        await page.route('**/menu/children/**', route => {
            requests++;
            return route.request().url().endsWith('/tools') ? route.fulfill({ status, json: { message: 'Unauthenticated' } }) :
                route.fulfill({ json: { items: [withHtml({ id: 'leaf', text: 'Saved branch', href: '/leaf' })] } });
        });
        await click(page, desktop('clients'));
        await page.waitForSelector('[data-menu-item=leaf]');
        assert.notEqual(await page.evaluate(() => sessionStorage.getItem('ib-menu-branches:v1')), null);
        await click(page, desktop('tools'));
        await page.waitForSelector('[data-menu-children=tools] [data-menu-error=sessionExpired]');
        assert.equal(await page.evaluate(() => sessionStorage.getItem('ib-menu-branches:v1')), null);
        assert.equal(await page.locator('[data-menu-item=leaf]').count(), 0);
        assert.equal(await page.locator('[data-menu-retry]').count(), 0);
        if (status === 401) {
            assert.equal(await page.locator('[data-menu-children=tools] [data-menu-login]').getAttribute('href'), 'http://menu.test/sign-in');
        } else {
            assert.equal(await page.locator('[data-menu-children=tools] [data-menu-reload]').textContent(), 'Reload page');
        }
        if (await page.locator(desktop('clients')).getAttribute('aria-expanded') === 'true') await click(page, desktop('clients'));
        await click(page, desktop('clients'));
        await page.waitForSelector('[data-menu-children=clients] [data-menu-error=sessionExpired]');
        assert.equal(requests, 2, 'A known expired session must not reuse cached items or start more downloads.');
        await page.close();
    });
}

test('a redirect to the configured login page is treated as an expired session', async () => {
    const data = structuredClone(payload);
    data.options.loginUrl = '/sign-in';
    // Real HTTP verifies fetch's final URL and redirected flag across a 302.
    const server = http.createServer((request, response) => {
        if (request.url === '/menu/children/clients') {
            response.writeHead(302, { location: '/sign-in' });
            response.end();
        } else {
            response.writeHead(200, { 'content-type': 'text/html' });
            response.end('<!doctype html><html><head></head><body>Login</body></html>');
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    let page;
    try {
        page = await fixture(data, false, undefined, origin + '/');
        await click(page, desktop('clients'));
        await page.waitForSelector('[data-menu-error=sessionExpired]');
        assert.equal(await page.locator('[data-menu-login]').getAttribute('href'), origin + '/sign-in');
        assert.equal(await page.locator('[data-menu-retry]').count(), 0);
    } finally {
        if (page) await page.close();
        await new Promise(resolve => server.close(resolve));
    }
});

test('desktop and mobile share a timeout; retry succeeds and ignores the late response', async () => {
    const data = cachedPayload();
    data.options.requestTimeoutMs = 1000;
    const page = await fixture(data);
    await page.evaluate(() => {
        const fetch = window.fetch;
        window.menuAbortCount = 0;
        window.fetch = function (url, options) {
            if (options.signal) options.signal.addEventListener('abort', () => window.menuAbortCount++);
            return fetch.call(this, url, options);
        };
    });
    let requests = 0;
    let release;
    let finish;
    const gate = new Promise(resolve => { release = resolve; });
    const finished = new Promise(resolve => { finish = resolve; });
    await page.route('**/menu/children/clients', async route => {
        const first = ++requests === 1;
        if (first) await gate;
        try {
            await route.fulfill({ json: { items: [withHtml({ id: 'leaf', text: first ? 'Late response' : 'Fresh response', href: '/leaf' })] } });
        } catch (error) {
            if (!first) throw error; // The first request was intentionally aborted.
        } finally { if (first) finish(); }
    });
    await click(page, desktop('clients'));
    await click(page, '[data-menu-hamburger]');
    await click(page, sidebar('clients'));
    await page.waitForFunction(() => document.querySelectorAll('[data-menu-error=timeout]').length === 2);
    assert.equal(requests, 1);
    assert.equal(await page.evaluate(() => window.menuAbortCount), 1);
    assert.equal(await page.locator('[aria-busy=true]').count(), 0);
    await click(page, '.ib-menu-sidebar [data-menu-retry=clients]');
    await page.waitForSelector('.ib-menu-sidebar [data-menu-item=leaf]');
    // Opening the hamburger closed the desktop drop; reopen it using the
    // successful mobile retry, which must not cause another HTTP request.
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-primary] [data-menu-item=leaf]');
    assert.equal(requests, 2);
    release();
    await finished;
    await fixture(data, false, page);
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-item=leaf]');
    assert.equal(await page.locator('[data-menu-item=leaf]').textContent(), 'Fresh response');
    assert.equal(requests, 2);
    await page.close();
});

test('timeout covers a stalled JSON body even without AbortController', async () => {
    const data = structuredClone(payload);
    data.options.requestTimeoutMs = 200;
    data.messages = { timeout: 'Tempo massimo superato' };
    const page = await fixture(data);
    await page.route('**/menu/children/clients', route => route.fulfill({ json: { items: [child] } }));
    await page.evaluate(() => {
        const fetch = window.fetch;
        window.AbortController = undefined;
        window.menuFetchCount = 0;
        window.fetch = function (url, options) {
            if (++window.menuFetchCount > 1) return fetch.call(this, url, options);
            return Promise.resolve({ ok: true, status: 200, redirected: false, headers: new Headers({ 'content-type': 'application/json' }), json: () => new Promise(() => {}) });
        };
    });
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-error=timeout]');
    assert.match(await page.locator('[data-menu-error=timeout]').textContent(), /Tempo massimo superato/);
    await click(page, '[data-menu-retry=clients]');
    await page.waitForSelector('[data-menu-item=active]');
    assert.equal(await page.evaluate(() => window.menuFetchCount), 2);
    await page.close();
});

test('native mobile error messages wrap without overflowing the panel', { skip: !process.env.UIKIT_JS_PATH || !process.env.UIKIT_CSS_PATH }, async () => {
    const data = structuredClone(payload);
    data.options.loginUrl = '/sign-in';
    data.messages = { sessionExpired: 'La sessione è scaduta. Accedi di nuovo per continuare a utilizzare le voci del menu.' };
    const page = await fixture(data, true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/menu/children/clients', route => route.fulfill({ status: 401, json: { message: 'Unauthenticated' } }));
    await click(page, '[data-menu-hamburger]');
    await click(page, sidebar('clients'));
    await page.waitForSelector('.ib-menu-sidebar [data-menu-error=sessionExpired]');
    const overflow = await page.locator('.uk-offcanvas-bar').evaluate(bar => bar.scrollWidth - bar.clientWidth);
    assert.ok(overflow <= 1, 'Error text should wrap inside the mobile panel.');
    assert.equal(await page.locator('.ib-menu-sidebar [data-menu-login]').isVisible(), true);
    await page.close();
});

for (const native of [false, true]) {
    test('active mobile path loads only its ancestors and keeps page state' + (native ? ' with UIkit' : ''), { skip: native && !process.env.UIKIT_JS_PATH }, async () => {
        const data = structuredClone(payload);
        data.activeState = { items: ['detail'], ancestors: ['clients', 'active'] };
        data.navbars[0].items.push({ ...branch, id: 'unrelated', childrenUrl: '/menu/children/unrelated' });
        const page = await fixture(data, native);
        const requests = [];
        await page.route('**/menu/children/**', route => {
            const id = route.request().url().split('/').pop();
            requests.push(id);
            return route.fulfill({ json: { items: id === 'clients' ? [child, withHtml({ id: 'wrong', text: 'Wrong', href: '/other', active: true, classes: 'uk-text-bold custom' })] : [withHtml({ id: 'detail', text: 'Detail', href: '/detail' })] } });
        });
        assert.deepEqual(requests, []);
        assert.equal(await page.locator('[data-menu-primary] [data-menu-item=clients]').getAttribute('class').then(value => value.includes('uk-active')), true);
        assert.equal(await page.locator(desktop('clients')).getAttribute('aria-expanded'), 'false');
        await click(page, '[data-menu-hamburger]');
        await page.waitForSelector('.ib-menu-sidebar [data-menu-item=detail] > a[aria-current=page]');
        assert.deepEqual(requests, ['clients', 'active']);
        assert.equal(await page.locator(sidebar('clients')).getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator(sidebar('active')).getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator(sidebar('unrelated')).getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('.ib-menu-sidebar [data-menu-item=wrong]').getAttribute('class').then(value => value.includes('uk-active')), false);
        assert.equal(await page.locator('.ib-menu-sidebar [data-menu-item=wrong] > a').getAttribute('aria-current'), null);
        assert.equal(await page.locator('.ib-menu-sidebar [data-menu-item=wrong] > a').getAttribute('class').then(value => value.includes('uk-text-bold')), true);
        assert.equal(await page.locator('.ib-menu-sidebar [data-menu-item=detail]').isVisible(), true);
        await click(page, desktop('clients'));
        await page.waitForSelector('[data-menu-primary] [data-menu-item=active].uk-active');
        await click(page, desktop('active'));
        await page.waitForSelector('[data-menu-primary] [data-menu-item=detail] > a[aria-current=page]');
        assert.deepEqual(requests, ['clients', 'active']);
        await page.close();
    });
}

test('active path expansion can be disabled independently of highlighting', async () => {
    const data = structuredClone(payload);
    data.activeState = { items: [], ancestors: ['clients'] };
    data.options.openMobilePath = false;
    const page = await fixture(data);
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await click(page, '[data-menu-hamburger]');
    assert.deepEqual(requests, []);
    assert.equal(await page.locator(sidebar('clients')).getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('.ib-menu-sidebar [data-menu-item=clients]').getAttribute('class').then(value => value.includes('uk-active')), true);
    await page.close();
});

test('closing an active path during download does not expand its descendants', async () => {
    const data = structuredClone(payload);
    data.activeState = { items: ['detail'], ancestors: ['clients', 'active'] };
    const page = await fixture(data);
    const requests = [];
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/menu/children/**', async route => {
        const id = route.request().url().split('/').pop();
        requests.push(id);
        if (id === 'clients') await gate;
        await route.fulfill({ json: { items: id === 'clients' ? [child] : [withHtml({ id: 'detail', text: 'Detail', href: '/detail' })] } });
    });
    await click(page, '[data-menu-hamburger]');
    await page.waitForSelector('.ib-menu-sidebar [aria-busy=true]');
    await click(page, sidebar('clients'));
    release();
    await page.waitForSelector(sidebar('active'), { state: 'attached' });
    assert.deepEqual(requests, ['clients']);
    assert.equal(await page.locator(sidebar('active')).getAttribute('aria-expanded'), 'false');
    await click(page, sidebar('clients'));
    await page.waitForSelector('.ib-menu-sidebar [data-menu-item=detail] > a[aria-current=page]');
    assert.deepEqual(requests, ['clients', 'active']);
    // Once revealed, reopening a parent preserves the user's collapsed child.
    await click(page, sidebar('active'));
    await click(page, sidebar('clients'));
    await click(page, sidebar('clients'));
    assert.equal(await page.locator(sidebar('active')).getAttribute('aria-expanded'), 'false');
    await page.close();
});

test('traditional mobile menus open highlighted ancestors once using native Nav', { skip: !process.env.UIKIT_JS_PATH }, async () => {
    const page = await fixture(payload, true);
    await page.evaluate(() => {
        const sidebar = document.createElement('div');
        sidebar.id = 'legacy-sidebar';
        sidebar.setAttribute('data-ib-menu-offcanvas', '');
        sidebar.setAttribute('data-menu-open-active-path', 'true');
        sidebar.setAttribute('uk-offcanvas', '');
        sidebar.innerHTML = '<div class="uk-offcanvas-bar"><ul uk-nav="multiple: true">' +
            '<li id="legacy-parent" class="uk-parent uk-active"><a href="#">Parent</a><ul class="uk-nav-sub" uk-nav="multiple: true">' +
            '<li id="legacy-nested" class="uk-parent uk-active"><a href="#">Nested</a><ul class="uk-nav-sub"><li class="uk-active"><a href="/current">Current</a></li></ul></li></ul></li>' +
            '<li id="legacy-other" class="uk-parent"><a href="#">Other</a><ul class="uk-nav-sub"><li><a href="/other">Other page</a></li></ul></li></ul></div>';
        document.body.appendChild(sidebar);
        window.IlBronzaProgressiveMenu.init(sidebar);
        window.UIkit.update(sidebar);
        window.UIkit.offcanvas(sidebar, { container: false }).show();
    });
    await page.waitForFunction(() => document.querySelector('#legacy-nested').classList.contains('uk-open'));
    assert.equal(await page.locator('#legacy-parent').getAttribute('class').then(value => value.includes('uk-open')), true);
    assert.equal(await page.locator('#legacy-other').getAttribute('class').then(value => value.includes('uk-open')), false);
    assert.equal(await page.locator('#legacy-nested > a').getAttribute('aria-expanded'), 'true');
    await page.evaluate(() => {
        const nested = document.querySelector('#legacy-nested');
        window.UIkit.getComponent(nested.parentElement, 'nav').toggle(0, false);
        document.querySelector('#legacy-sidebar').dispatchEvent(new Event('beforeshow', { bubbles: true }));
    });
    assert.equal(await page.locator('#legacy-nested').getAttribute('class').then(value => value.includes('uk-open')), false);
    await page.close();
});

test('explicit columns distribute all fetched items even when the branch changed size', async () => {
    const data = structuredClone(payload);
    data.navbars[0].items[0].fixedColumns = 4;
    const page = await fixture(data);
    await page.route('**/menu/children/clients', route => route.fulfill({ json: { items: Array.from({ length: 5 }, (_, i) => withHtml({ id: 'leaf-' + i, text: 'Leaf ' + i, href: '/leaf-' + i })) } }));
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-item=leaf-4]');
    const sizes = await page.locator('[data-menu-children=clients] .uk-drop-grid > div > ul').evaluateAll(lists => lists.map(list => list.children.length));
    assert.deepEqual(sizes, [2, 1, 1, 1]);
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
    assert.equal(await page.locator('[data-menu-item=home]>a').first().getAttribute('href'), '/');
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
    await page.locator(desktop('click-only')).dispatchEvent('pointerenter', { pointerType: 'mouse' });
    assert.equal(await page.locator(desktop('click-only')).getAttribute('aria-expanded'), 'false');
    await page.locator(desktop('clients')).dispatchEvent('pointerenter', { pointerType: 'mouse' });
    await page.waitForFunction(() => document.querySelector('[data-menu-children=clients]').classList.contains('uk-open'));
    await page.locator(desktop('clients')).focus();
    await page.keyboard.press('Escape');
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
            // The current page's path may already have opened this branch.
            await page.waitForSelector(sidebar(id), { state: 'attached' });
            if (await page.locator(sidebar(id)).getAttribute('aria-expanded') !== 'true') await click(page, sidebar(id));
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

test('native mobile Nav controls nested branches and Offcanvas fits the viewport', { skip: !process.env.UIKIT_JS_PATH || !process.env.UIKIT_CSS_PATH }, async () => {
    const page = await fixture(payload, true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/menu/children/**', route => route.fulfill({ json: { items: route.request().url().endsWith('/clients') ? [child] : [withHtml({ id: 'detail', text: 'Detail', href: '/detail' })] } }));
    assert.equal(await page.locator('[data-menu-hamburger]').evaluate(node => !!node.closest('[uk-navbar]')), true);
    await page.locator('[data-menu-hamburger]').click();
    await page.waitForFunction(() => document.querySelector('.ib-menu-sidebar').classList.contains('uk-open'));
    await page.locator(sidebar('clients')).click();
    await page.waitForSelector('.ib-menu-sidebar [data-menu-item=active]');
    assert.equal(await page.locator('.ib-menu-sidebar .uk-nav-default').evaluate(list => UIkit.getComponent(list, 'nav').items.length), 1);
    await page.locator(sidebar('active')).click();
    await page.waitForSelector('.ib-menu-sidebar [data-menu-item=detail]');
    assert.equal(await page.locator('.ib-menu-sidebar [data-menu-children=clients]').evaluate(list => !!UIkit.getComponent(list, 'nav')), true);
    await page.locator('.ib-menu-sidebar [data-menu-item=detail] > a').focus();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator(sidebar('active')).getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator(sidebar('clients')).getAttribute('aria-expanded'), 'true');
    const width = await page.locator('.ib-menu-sidebar .uk-offcanvas-bar').evaluate(bar => bar.getBoundingClientRect().width);
    assert.ok(width <= 390, 'Offcanvas follows the framework width without a 600px inner wrapper.');
    await page.locator('.ib-menu-sidebar .uk-offcanvas-close').click();
    await page.waitForFunction(() => document.querySelector('[data-menu-hamburger]').getAttribute('aria-expanded') === 'false');
    await page.close();
});

test('a native parent link opens first and remains navigable once its dropdown is open', { skip: !process.env.UIKIT_JS_PATH }, async () => {
    const data = structuredClone(payload);
    data.navbars[0].items[0].href = '/clients';
    const page = await fixture(data, true);
    await page.route('**/menu/children/clients', route => route.fulfill({ json: { items: [child] } }));
    await page.waitForFunction(() => !!UIkit.getComponent(document.querySelector('[data-menu-item=clients] > a'), 'toggle'));
    await page.locator(desktop('clients')).evaluate(link => link.addEventListener('click', event => {
        window.parentClickPrevented = event.defaultPrevented;
        event.preventDefault(); // Observe navigation intent without leaving the fixture.
    }));
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-item=active]');
    assert.equal(await page.evaluate(() => window.parentClickPrevented), true);
    assert.equal(await page.locator(desktop('clients')).getAttribute('href'), '/clients');
    await click(page, desktop('clients'));
    assert.equal(await page.evaluate(() => window.parentClickPrevented), false);
    assert.equal(await page.locator(desktop('clients') + ' [role=button]').count(), 0);
    await page.close();
});

test('an external action keeps its native toggle and gets a separate submenu button', { skip: !process.env.UIKIT_JS_PATH }, async () => {
    const data = structuredClone(payload);
    data.navbars[0].items[0].toggle = '#external-panel';
    const page = await fixture(data, true);
    await page.evaluate(() => {
        const target = document.createElement('div');
        target.id = 'external-panel';
        target.hidden = true;
        document.body.appendChild(target);
    });
    await page.route('**/menu/children/clients', route => route.fulfill({ json: { items: [child] } }));
    assert.equal(await page.locator(desktop('clients')).evaluate(control => control.tagName), 'BUTTON');
    assert.equal(await page.locator('[data-menu-item=clients] > a').first().getAttribute('uk-toggle'), 'target: #external-panel');
    await click(page, desktop('clients'));
    await page.waitForSelector('[data-menu-item=active]');
    assert.equal(await page.locator('#external-panel').isVisible(), false);
    await click(page, '[data-menu-primary] [data-menu-item=clients] > a');
    await page.waitForFunction(() => !document.querySelector('#external-panel').hidden);
    await page.close();
});
