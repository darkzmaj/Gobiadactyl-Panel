// The demo's stand-in for the Panel's Blade layout: window.SiteConfiguration, the signed-in user and the colour
// scheme, before any stylesheet or module runs. demo/build.mjs fills in the site configuration.
(function () {
    var site = "__SITE__";
    var read = function (key) {
        try {
            return window.localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    };
    var signedIn = read('gobia-demo:session') === '1';
    var path = window.location.pathname;

    // The Panel redirects on the server; the demo does it here, before the app boots.
    if (!signedIn && path.indexOf('/auth/') !== 0) {
        window.location.replace('/auth/login');
        return;
    }
    if (signedIn && path.indexOf('/auth/') === 0) {
        window.location.replace('/');
        return;
    }

    if (signedIn) {
        window.PterodactylUser = {
            uuid: 'd3e10000-0000-4000-8000-000000000001',
            username: 'demo',
            email: 'demo@example.com',
            root_admin: true,
            use_totp: false,
            language: 'en',
            avatar: null,
            updated_at: '2026-11-01T09:00:00+00:00',
            created_at: '2026-01-15T09:00:00+00:00',
        };
    } else {
        // Guests get no screens or views and only extensions with public settings, like on the Panel.
        site.extensions = site.extensions
            .filter(function (e) {
                return e.theme || e.id === 'gobia-core';
            })
            .map(function (e) {
                return { id: e.id, entry: e.entry, prefix: e.prefix, translations: null, config: e.config, development: null, theme: e.theme };
            });
    }
    // The panel time zone (Gobia Core, Time): Europe/Ljubljana unless changed in the demo's admin settings.
    var zone = read('gobia-demo:timezone');
    site.timezone = zone === 'browser' ? null : zone || 'Europe/Ljubljana';
    window.SiteConfiguration = site;

    var preference = read('gobia-demo:scheme') || 'system';
    var scheme = preference === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : preference;
    document.documentElement.className = scheme;
    site.theme.scheme = scheme;
})();
