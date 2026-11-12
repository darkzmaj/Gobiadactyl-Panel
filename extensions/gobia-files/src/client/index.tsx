import './styles.css';
import { definePterodactylExtension } from '@pterodactyl/sdk';

export default definePterodactylExtension({
    setup({ views }) {
        // The workspace (and with it Monaco) loads only when a server's file page opens.
        views.override('server.files.manager', { load: () => import('./workspace/Workspace') });
        // The core editor page forwards to the workspace, so there is a single editor.
        views.override('server.files.editor', { load: () => import('./workspace/EditorRedirect') });
    },
});
