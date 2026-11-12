import { lazy, Suspense } from 'react';
import type { ViewProps } from '@pterodactyl/sdk';
import { useEditorMode } from './editorMode';

// The workspace (and with it Monaco) loads only when a server's file page opens in the Gobia mode.
const Workspace = lazy(() => import('./workspace/Workspace'));
const EditorRedirect = lazy(() => import('./workspace/EditorRedirect'));

const placeholder = <div className={'gb-skeleton'} style={{ height: 320, borderRadius: 14 }} aria-busy />;

/** The file page: the Gobia workspace, or the panel's own file list in the legacy mode. */
export function FileManagerLayer(props: ViewProps<'server.files.manager'>) {
    if (useEditorMode() === 'legacy') {
        return <props.Default />;
    }

    return (
        <Suspense fallback={placeholder}>
            <Workspace {...props} />
        </Suspense>
    );
}

/**
 * The editor page: in the Gobia mode it forwards into the workspace (one editor in the product); in the legacy mode the
 * panel's own editor page stays, with Monaco as its editing surface (`server.files.editor.canvas`).
 */
export function FileEditorLayer(props: ViewProps<'server.files.editor'>) {
    if (useEditorMode() === 'legacy') {
        return <props.Default />;
    }

    return (
        <Suspense fallback={placeholder}>
            <EditorRedirect {...props} />
        </Suspense>
    );
}
