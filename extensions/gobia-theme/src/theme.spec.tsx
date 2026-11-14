import { afterEach, beforeAll, expect, test } from 'vitest';
import { preloadTheme, renderView, type RenderedView } from '@pterodactyl/sdk/testing';
import theme from './theme';

const themes = [theme];

let rendered: RenderedView | undefined;

// Loads the chunks of views declared with lazyView, so renderView renders them at once.
beforeAll(() => preloadTheme(themes));
afterEach(() => rendered?.unmount());

test('draws the Gobia shell with the admin groups, keeping the navigation slots', () => {
    rendered = renderView('layout.app', { themes, fixture: 'adminArea' });

    const sidebar = rendered.container.querySelector('#gb-sidebar');

    expect(rendered.container.querySelector('.gb-app main')).not.toBeNull();
    expect(sidebar?.textContent).toContain('Dashboard');
    expect(sidebar?.textContent).not.toContain('API Keys');
});

test('draws the instance card and pages in a server', () => {
    rendered = renderView('layout.app', { themes, fixture: 'serverArea' });

    expect(rendered.container.querySelector('.gb-switcher')).not.toBeNull();
    expect(rendered.container.querySelector('#gb-sidebar')?.textContent).toContain('All instances');
});

test('frames the sign-in pages with the Gobia card', () => {
    rendered = renderView('page.auth.login', { themes });

    expect(rendered.container.querySelector('.gb-auth-box h1')?.textContent).toBe('Login');
});

test('titles the sign-in tab with the panel name, never upstream default "Pterodactyl"', () => {
    document.title = 'Pterodactyl';
    rendered = renderView('layout.auth', { themes });

    expect(document.title).toBe('Gobia');
    expect(rendered.container.querySelector('.gb-auth-logo img')?.getAttribute('alt')).toBe('Gobia');
});
