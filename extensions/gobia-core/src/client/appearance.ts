export type Scheme = 'system' | 'light' | 'dark';

export const SCHEMES: readonly Scheme[] = ['system', 'light', 'dark'];

/**
 * Asked for by the Gobia theme's profile menu; ProfileSync saves it to the profile. The Panel itself applies a scheme
 * (`useTheme().setScheme`, the `pterodactyl_scheme` cookie); the profile copy makes the choice follow the person to
 * other devices.
 */
export const SCHEME_REQUEST_EVENT = 'gobia:scheme-request';

/** Narrows a stored string to a scheme, falling back to `system` for anything unrecognised. */
export function parseScheme(value: string | null | undefined): Scheme {
    return SCHEMES.find((scheme) => scheme === value) ?? 'system';
}
