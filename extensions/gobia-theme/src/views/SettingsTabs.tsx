import { PanelLink, useCurrentServer, useCurrentServerPermissions, usePanelLocation } from '@pterodactyl/sdk';
import type { ViewProps } from '@pterodactyl/sdk/theme';

const holds = (granted: readonly string[], permission: string) =>
    granted.some(
        (held) =>
            held === '*' ||
            held === permission ||
            (permission.endsWith('.*') && held.startsWith(permission.slice(0, -1)))
    );

/**
 * Settings has two tabs, each its own address: General (/settings) and Startup (/settings/startup). A tab the person
 * may not use is not shown, and with a single tab there is no tab bar. The page itself stays classic's.
 */
export default function SettingsTabs({
    Default,
}: ViewProps<'page.server.settings'> | ViewProps<'page.server.startup'>) {
    const identifier = useCurrentServer((server) => server.attributes.identifier);
    const granted = useCurrentServerPermissions();
    const { pathname } = usePanelLocation();
    const base = `/server/${identifier ?? ''}/settings`;
    const tabs = [
        ...(holds(granted, 'settings.*') || holds(granted, 'file.sftp') ? [{ label: 'General', to: base }] : []),
        ...(holds(granted, 'startup.*') ? [{ label: 'Startup', to: `${base}/startup` }] : []),
    ];
    const path = pathname.replace(/\/+$/, '');

    return (
        <>
            {identifier && tabs.length > 1 && (
                <nav aria-label='Settings' className='page-width mt-4 sm:mt-6 flex flex-wrap border-b border-border'>
                    {tabs.map((tab) => {
                        const active = tab.to === path;

                        return (
                            <PanelLink
                                key={tab.to}
                                destination={{ to: tab.to } as never}
                                aria-current={active ? 'page' : undefined}
                                className={`px-4 py-2 text-sm border-b-2 no-underline transition-colors duration-150 ${
                                    active
                                        ? 'border-primary text-foreground'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {tab.label}
                            </PanelLink>
                        );
                    })}
                </nav>
            )}
            <Default />
        </>
    );
}
