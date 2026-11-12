import type { ReactNode } from 'react';
import { Main, defineTheme, lazyView } from '@pterodactyl/sdk/theme';
import { skins } from './skins';
import AuthLayout from './views/auth/AuthLayout';

/** The Gobia shell draws the server's and the admin area's navigation itself, so those layouts only place the page. */
function AreaLayout({ children }: { children?: ReactNode }) {
    return <Main>{children}</Main>;
}

const auth = () => import('./views/auth/pages');

/**
 * The Gobia look on the Pterodactyl theme platform: tokens and the gb-* component layer (theme.css), the Gobia shell
 * (layout.app), the account menu, and the sign-in screens. Everything else stays classic and follows the tokens.
 * Only layout.auth and the thin area layouts load with the entry; every other view loads when first shown.
 */
export default defineTheme({
    ui: skins,
    views: {
        'layout.app': lazyView(() => import('./views/Shell')),
        'layout.server': AreaLayout,
        'layout.admin': AreaLayout,
        'layout.account': lazyView(() => import('./views/AccountLayout')),
        'layout.auth': AuthLayout,
        'server.sftp': lazyView(() => import('./views/ServerSftp')),
        'server.startup.image': lazyView(() => import('./views/StartupImage')),
        'page.account.overview': lazyView(() => import('./views/AccountSecurity')),
        'page.server.settings': lazyView(() => import('./views/SettingsTabs')),
        'page.server.startup': lazyView(() => import('./views/SettingsTabs')),
        'page.auth.login': lazyView(auth, 'LoginPage'),
        'page.auth.checkpoint': lazyView(auth, 'CheckpointPage'),
        'page.auth.password': lazyView(auth, 'ForgotPasswordPage'),
        'page.auth.passwordReset': lazyView(auth, 'ResetPasswordPage'),
    },
});
