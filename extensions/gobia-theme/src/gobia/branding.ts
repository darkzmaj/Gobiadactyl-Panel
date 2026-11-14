import { useSyncExternalStore } from 'react';

/**
 * Branding values the gobia-core extension publishes for the shell: the admin uploaded logo and the user's avatar.
 * They travel through data attributes on <html> plus one window event, so the core shell never imports extension code.
 */
export const BRANDING_EVENT = 'gobia:branding';
export const DEFAULT_LOGO = '/gobia/img/logo-text-240.png';
export const DEFAULT_LOGO_2X = '/gobia/img/logo-text-480.png';
export const DEFAULT_ICON = '/gobia/img/icon-64.png';

type Key = 'logo' | 'avatar';

const attribute = (key: Key) => (key === 'logo' ? 'data-gobia-logo' : 'data-gobia-avatar');

const read = (key: Key): string => document.documentElement.getAttribute(attribute(key)) ?? '';

function subscribe(listener: () => void): () => void {
    window.addEventListener(BRANDING_EVENT, listener);

    return () => window.removeEventListener(BRANDING_EVENT, listener);
}

export const useBranding = (key: Key): string =>
    useSyncExternalStore(
        subscribe,
        () => read(key),
        () => ''
    );

/** The panel name to show: the configured one, or Gobia while the panel still carries upstream's default name. */
export const brandName = (name: string | null | undefined): string =>
    name && name.trim() !== '' && name.trim() !== 'Pterodactyl' ? name.trim() : 'Gobia';
