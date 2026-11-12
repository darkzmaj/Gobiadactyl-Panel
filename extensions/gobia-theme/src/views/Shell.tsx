import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
    Activity,
    Archive,
    ArrowLeft,
    Blocks,
    Clock,
    Copy,
    Database,
    Egg,
    ExternalLink,
    Folder,
    FolderTree,
    KeyRound,
    LayoutDashboard,
    MapPin,
    Menu,
    Network,
    Palette,
    RefreshCw,
    Server,
    Settings,
    ShieldCheck,
    SquareTerminal,
    Tag,
    Users,
    X,
    type LucideIcon,
} from 'lucide-react';
import { NamedIcon, NavigationLabel, PanelLink, SpinnerOverlay, usePanelLocation } from '@pterodactyl/sdk';
import {
    Main,
    Navigation,
    NavigationLink,
    Slot,
    type NavItem,
    type AdminArea,
    type AppLayoutModel,
    type ServerArea,
    type ViewProps,
} from '@pterodactyl/sdk/theme';
import { DEFAULT_ICON, DEFAULT_LOGO, DEFAULT_LOGO_2X, useBranding } from '../gobia/branding';
import Footer from './Footer';
import ServerCard from './ServerCard';
import UserMenu from './UserMenu';

const NavLabel = ({ children }: { children: ReactNode }) => <div className='gb-nav-label'>{children}</div>;

/** True on `prefix` and every page below it. */
const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

function Item({
    item,
    active,
    icon: Icon,
    label,
}: {
    item: NavItem;
    active: boolean;
    icon?: LucideIcon;
    label?: string;
}) {
    return (
        <NavigationLink
            item={item}
            className={`gb-nav-item${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
        >
            {Icon ? <Icon aria-hidden /> : item.icon && <NamedIcon name={item.icon} size={16} aria-hidden />}
            <span>
                <NavigationLabel label={label ?? item.label} icon={undefined} />
            </span>
        </NavigationLink>
    );
}

const linkIcons = {
    dashboard: Server,
    account: Settings,
    admin: ShieldCheck,
} satisfies Record<AppLayoutModel['links'][number]['id'], LucideIcon>;
const linkGroups = {
    dashboard: 'Workspace',
    account: 'Account',
    admin: 'Administration',
} satisfies Record<AppLayoutModel['links'][number]['id'], string>;
// The Gobia order: the workspace, the person's account, then administration.
const linkOrder: AppLayoutModel['links'][number]['id'][] = ['dashboard', 'account', 'admin'];
const linkLabels = {
    dashboard: 'Instances',
    account: 'Account',
    admin: 'Admin',
} satisfies Record<AppLayoutModel['links'][number]['id'], string>;

/** Instances, account and administration: the sidebar beside the instance list and the account pages. */
function DefaultSidebar({ links }: { links: AppLayoutModel['links'] }) {
    const { pathname } = usePanelLocation();

    return (
        <>
            {[...links]
                .sort((a, b) => linkOrder.indexOf(a.id) - linkOrder.indexOf(b.id))
                .map((link) => {
                    const Icon = linkIcons[link.id];
                    const active =
                        link.id === 'dashboard'
                            ? pathname === '/'
                            : under(pathname, link.id === 'admin' ? '/panel' : '/account');

                    return (
                        <div key={link.id}>
                            <NavLabel>{linkGroups[link.id]}</NavLabel>
                            <PanelLink
                                destination={link.destination}
                                exact={link.exact}
                                className={`gb-nav-item${active ? ' active' : ''}`}
                                aria-current={active ? 'page' : undefined}
                            >
                                <Icon aria-hidden />
                                <span>{linkLabels[link.id]}</span>
                            </PanelLink>
                        </div>
                    );
                })}
        </>
    );
}

const serverIcons = new Map<string, LucideIcon>(
    Object.entries({
        index: SquareTerminal,
        files: Folder,
        databases: Database,
        schedules: Clock,
        backups: Archive,
        ports: Network,
        settings: Settings,
        activity: Activity,
    })
);

/** Back to the list, the instance card (a switcher) and the instance's pages. */
function ServerSidebar({
    area,
    dashboard,
}: {
    area: ServerArea;
    dashboard: AppLayoutModel['links'][number] | undefined;
}) {
    const { pathname } = usePanelLocation();
    const base = `/server/${area.identifier}`;

    return (
        <>
            {dashboard && (
                <PanelLink destination={dashboard.destination} exact className='gb-nav-item'>
                    <ArrowLeft aria-hidden />
                    <span>All instances</span>
                </PanelLink>
            )}
            <ServerCard area={area} />
            <NavLabel>Instance</NavLabel>
            <Slot name='server.navigation.before' data={area.server} />
            <Navigation items={area.nav.items}>
                {(item, { active }) => (
                    <Item
                        key={item.id}
                        item={item}
                        icon={serverIcons.get(item.id)}
                        // Startup is a tab of Settings with an address of its own.
                        active={active || (item.id === 'settings' && under(pathname, `${base}/settings`))}
                    />
                )}
            </Navigation>
            <Slot name='server.navigation.after' data={area.server} />
            {area.adminLink && (
                <>
                    <NavLabel>Administration</NavLabel>
                    <NavigationLink item={area.adminLink} className='gb-nav-item'>
                        <ExternalLink aria-hidden />
                        <span>Manage in admin</span>
                    </NavigationLink>
                </>
            )}
        </>
    );
}

const adminIcons = new Map<string, LucideIcon>(
    Object.entries({
        index: LayoutDashboard,
        activity: Activity,
        users: Users,
        nodes: Network,
        locations: MapPin,
        servers: Server,
        templates: Copy,
        databases: Database,
        mounts: FolderTree,
        eggs: Egg,
        tags: Tag,
        extensions: Blocks,
        api: KeyRound,
        settings: Settings,
        themes: Palette,
        updates: RefreshCw,
    })
);

// The Gobia admin groups; an entry no group names (an extension screen) lands at the end of System.
const adminGroups: { label: string; ids: string[] }[] = [
    { label: 'Dashboard', ids: ['index', 'users'] },
    { label: 'Network', ids: ['nodes', 'locations', 'templates'] },
    { label: 'Services', ids: ['eggs', 'databases'] },
    { label: 'System', ids: ['settings', 'updates'] },
];

// Pages that are tabs of another entry (AdminTabs): they have no entry of their own, and keep their host highlighted.
const adminTabsOf = new Map<string, string[]>(
    Object.entries({
        index: ['/panel/activity'],
        nodes: ['/panel/servers'],
        eggs: ['/panel/mounts'],
        settings: ['/panel/api', '/panel/extensions', '/panel/tags', '/panel/themes'],
    })
);
const adminHidden = new Set(['activity', 'servers', 'mounts', 'tags', 'extensions', 'api', 'themes']);
const adminLabels = new Map<string, string>(Object.entries({ nodes: 'Nodes & Instances', eggs: 'Eggs & Mounts' }));

/** Administration in the Gobia groups: Dashboard, Network, Services, System. */
function AdminSidebar({ area }: { area: AdminArea }) {
    const { pathname } = usePanelLocation();
    const items = area.nav.items.filter((item) => !adminHidden.has(item.id));
    const grouped = new Set(adminGroups.flatMap((group) => group.ids));
    const extra = items.filter((item) => !grouped.has(item.id));

    return (
        <>
            <Slot name='panel.navigation.before' />
            {adminGroups.map((group) => {
                const entries = group.ids
                    .map((id) => items.find((item) => item.id === id))
                    .filter((item): item is NavItem => item !== undefined)
                    .concat(group.label === 'System' ? extra : []);

                return entries.length === 0 ? null : (
                    <div key={group.label}>
                        <NavLabel>{group.label}</NavLabel>
                        <Navigation items={entries}>
                            {(item, { active }) => (
                                <Item
                                    key={item.id}
                                    item={item}
                                    icon={adminIcons.get(item.id)}
                                    label={adminLabels.get(item.id)}
                                    active={
                                        active ||
                                        (adminTabsOf.get(item.id) ?? []).some((prefix) => under(pathname, prefix))
                                    }
                                />
                            )}
                        </Navigation>
                    </div>
                );
            })}
            <Slot name='panel.navigation.after' />
        </>
    );
}

/** The wordmark: a logo uploaded through gobia-core, else the panel's logo setting, else the Gobia default. */
function Brand({
    brand,
    destination,
}: {
    brand: AppLayoutModel['brand'];
    destination: AppLayoutModel['links'][number]['destination'];
}) {
    const uploaded = useBranding('logo') || brand.logoUrl;

    return (
        <PanelLink destination={destination} className='gb-topbar-brand' aria-label={brand.name}>
            <img
                src={uploaded || DEFAULT_LOGO}
                srcSet={uploaded ? undefined : `${DEFAULT_LOGO} 1x, ${DEFAULT_LOGO_2X} 2x`}
                alt={brand.name}
                height={30}
            />
        </PanelLink>
    );
}

/** The Gobia application shell: top bar, a sidebar with the navigation of the area the user is in, the page, the footer. */
export default function Shell({ model, children }: ViewProps<'layout.app'>) {
    const { area, links } = model;
    const { pathname } = usePanelLocation();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const content = useRef<HTMLDivElement>(null);
    const dashboard = links.find((link) => link.id === 'dashboard');
    const account = links.find((link) => link.id === 'account');
    const admin = area.kind === 'admin';

    // Only the page area animates on navigation: restart its short fade without remounting anything.
    useEffect(() => {
        const element = content.current;

        if (!element) {
            return;
        }

        element.classList.remove('gb-route');
        void element.offsetWidth;
        element.classList.add('gb-route');
    }, [pathname]);

    // A long menu (the admin one) keeps the current page in view.
    useEffect(() => {
        const frame = requestAnimationFrame(() =>
            document.querySelector('.gb-sidebar-scroll [aria-current="page"]')?.scrollIntoView({ block: 'nearest' })
        );

        return () => cancelAnimationFrame(frame);
    }, [pathname]);

    // Navigating closes the mobile drawer; so does Escape.
    useEffect(() => setDrawerOpen(false), [pathname]);
    useEffect(() => {
        if (!drawerOpen) {
            return;
        }

        const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setDrawerOpen(false);

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [drawerOpen]);

    return (
        <div className={`gb-app${drawerOpen ? ' gb-drawer-open' : ''}`}>
            <SpinnerOverlay visible={model.signingOut} fixed />
            <header className='gb-topbar'>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <button
                        type='button'
                        className='gb-icon-btn gb-menu-toggle'
                        aria-label={drawerOpen ? 'Close navigation' : 'Open navigation'}
                        aria-expanded={drawerOpen}
                        aria-controls='gb-sidebar'
                        onClick={() => setDrawerOpen(!drawerOpen)}
                    >
                        {drawerOpen ? <X aria-hidden /> : <Menu aria-hidden />}
                    </button>
                    {dashboard && <Brand brand={model.brand} destination={dashboard.destination} />}
                </div>
                <div className='gb-topbar-actions'>
                    <Slot name='nav.items.before' />
                    <Slot name='nav.items.after' />
                    {admin && dashboard && (
                        <PanelLink destination={dashboard.destination} exact className='gb-btn gb-btn-sm gb-hide-sm'>
                            <Server aria-hidden /> Instances
                        </PanelLink>
                    )}
                    <UserMenu model={model} />
                </div>
            </header>
            <div className='gb-layout'>
                <div className='gb-sidebar-wrap'>
                    <aside id='gb-sidebar' className='gb-sidebar' aria-label='Primary'>
                        <nav className='gb-sidebar-scroll'>
                            {area.kind === 'server' && <ServerSidebar area={area} dashboard={dashboard} />}
                            {area.kind === 'admin' && <AdminSidebar area={area} />}
                            {(area.kind === 'dashboard' || area.kind === 'account') && <DefaultSidebar links={links} />}
                        </nav>
                        {(admin ? dashboard : account) && (
                            <PanelLink
                                destination={(admin ? dashboard : account)!.destination}
                                className='gb-sidebar-foot'
                            >
                                <img src={DEFAULT_ICON} alt='' />
                                <span style={{ minWidth: 0 }}>
                                    <strong>{model.brand.name}</strong>
                                    <span>{admin ? 'Back to instances' : 'Beyond The Clouds'}</span>
                                </span>
                            </PanelLink>
                        )}
                    </aside>
                </div>
                <div className='gb-drawer-backdrop' onClick={() => setDrawerOpen(false)} aria-hidden />
                <Main className='gb-main'>
                    <div ref={content} className='gb-main-inner'>
                        {children}
                    </div>
                </Main>
            </div>
            <Footer />
        </div>
    );
}
