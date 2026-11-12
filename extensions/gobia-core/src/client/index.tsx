import './styles.css';
import { definePterodactylExtension } from '@pterodactyl/sdk';
import OverviewPanel from './admin/OverviewPanel';
import ProfileSync from './ProfileSync';
import { applyLogo } from './branding';

export default definePterodactylExtension({
    setup({ screens, slots, views, config }) {
        applyLogo(String(config.logo ?? ''));
        slots.register('nav.items.after', ProfileSync);
        slots.register('panel.overview.before', OverviewPanel);
        screens.register('profile', () => import('./screens/ProfileScreen'));
        views.override('page.dashboard', { load: () => import('./dashboard/DashboardPage') });
        screens.register('access', () => import('./screens/AccessScreen'));
        screens.register('updates', () => import('./screens/UpdatesScreen'));
        screens.register('appearance', () => import('./screens/AppearanceScreen'));
    },
});
