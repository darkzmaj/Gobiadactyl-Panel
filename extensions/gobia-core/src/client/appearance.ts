export type Scheme = 'system' | 'light' | 'dark';

export const SCHEMES: readonly Scheme[] = ['system', 'light', 'dark'];

/**
 * Asked for by the Gobia theme's profile menu; ProfileSync saves it to the profile. The Panel itself applies a scheme
 * (`useTheme().setScheme`, the `pterodactyl_scheme` cookie); the profile copy makes the choice follow the person to
 * other devices.
 */
export const SCHEME_REQUEST_EVENT = 'gobia:scheme-request';

/** The Gobia file workspace, or the legacy file list with the Monaco editor. */
export type FileEditor = 'gobia' | 'legacy';

export const FILE_EDITORS: readonly FileEditor[] = ['gobia', 'legacy'];

const FILE_EDITOR_KEY = 'gobia:file-editor';
const FILE_EDITOR_EVENT = 'gobia:file-editor';

/**
 * Tells gobia-files which editor the person chose: `data-gobia-file-editor` on <html> plus an event, and a local copy
 * so the right editor shows on the next visit before the profile has loaded.
 */
export function publishFileEditor(editor: FileEditor): void {
    document.documentElement.dataset.gobiaFileEditor = editor;
    try {
        window.localStorage.setItem(FILE_EDITOR_KEY, editor);
    } catch {
        // Private mode: the profile still applies once it loads.
    }
    window.dispatchEvent(new Event(FILE_EDITOR_EVENT));
}

/** The choice remembered on this browser, published straight away while the profile loads. */
export function restoreFileEditor(): void {
    try {
        const stored = window.localStorage.getItem(FILE_EDITOR_KEY);
        if (stored === 'gobia' || stored === 'legacy') {
            document.documentElement.dataset.gobiaFileEditor = stored;
        }
    } catch {
        // Nothing remembered: gobia-files starts with the Gobia workspace.
    }
}

/** Narrows a stored string to a scheme, falling back to `system` for anything unrecognised. */
export function parseScheme(value: string | null | undefined): Scheme {
    return SCHEMES.find((scheme) => scheme === value) ?? 'system';
}
