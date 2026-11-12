import './styles.css';
import { definePterodactylExtension } from '@pterodactyl/sdk';
import { FileEditorLayer, FileManagerLayer } from './layers';

export default definePterodactylExtension({
    setup({ views }) {
        // The Gobia workspace, or the panel's own file list for people who chose the legacy editor (Account, Appearance).
        views.override('server.files.manager', FileManagerLayer);
        // In the Gobia mode the core editor page forwards to the workspace, so there is a single editor.
        views.override('server.files.editor', FileEditorLayer);
        // The editing surface of the core editor page (legacy mode): the same Monaco editor as the workspace.
        views.override('server.files.editor.canvas', { load: () => import('./legacy/MonacoCanvas') });
    },
});
