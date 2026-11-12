import {
    Activity,
    ChevronRight,
    KeyRound,
    Palette,
    ShieldCheck,
    Terminal,
    User,
    Users,
    type LucideIcon,
} from 'lucide-react';
import { Main, Navigation, NavigationLink, Slot, type ViewProps } from '@pterodactyl/sdk/theme';

const icons = new Map<string, LucideIcon>(
    Object.entries({
        index: ShieldCheck,
        profile: User,
        access: Users,
        activity: Activity,
        api: KeyRound,
        ssh: Terminal,
        appearance: Palette,
    })
);

// The Gobia order of the account menu; the stock overview (password, email, two-step) is Security there.
const ORDER = ['profile', 'index', 'access', 'activity', 'api', 'ssh', 'appearance'];
const rank = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);

/** Account pages: a local menu on the left, the page's cards on the right (the Gobia settings pattern). */
export default function AccountLayout({ model, children }: ViewProps<'layout.account'>) {
    const items = [...model.nav.items].sort((a, b) => rank(a.id) - rank(b.id));

    return (
        <div className='gb-split'>
            <nav className='gb-subnav' aria-label='Account'>
                <Slot name='account.navigation.before' />
                <Navigation items={items}>
                    {(item, { active, badge }) => {
                        const Icon = icons.get(item.id) ?? User;

                        return (
                            <NavigationLink
                                key={item.id}
                                item={item}
                                className={active ? 'active' : undefined}
                                aria-current={active ? 'page' : undefined}
                            >
                                <Icon aria-hidden />
                                <span>{item.id === 'index' ? 'Security' : item.label}</span>
                                {badge}
                                <ChevronRight aria-hidden className='gb-chevron' />
                            </NavigationLink>
                        );
                    }}
                </Navigation>
                <Slot name='account.navigation.after' />
            </nav>
            <Main className='gb-split-content'>{children}</Main>
        </div>
    );
}
