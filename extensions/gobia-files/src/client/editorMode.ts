import { useSyncExternalStore } from 'react';

/** Published by gobia-core from the person's profile (Account, Appearance, File editor). */
const EVENT = 'gobia:file-editor';

export type EditorMode = 'gobia' | 'legacy';

const read = (): EditorMode => (document.documentElement.dataset.gobiaFileEditor === 'legacy' ? 'legacy' : 'gobia');

function subscribe(listener: () => void): () => void {
    window.addEventListener(EVENT, listener);

    return () => window.removeEventListener(EVENT, listener);
}

/** The Gobia workspace unless the person chose the legacy file list; without gobia-core it is always the workspace. */
export const useEditorMode = (): EditorMode => useSyncExternalStore(subscribe, read, () => 'gobia');
