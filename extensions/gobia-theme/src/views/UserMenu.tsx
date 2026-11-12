import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Monitor, Moon, Palette, Settings, ShieldCheck, Sun, type LucideIcon } from 'lucide-react';
import { Avatar, PanelLink } from '@pterodactyl/sdk';
import { useNavigation, type AppLayoutModel, type ThemeSchemePreference } from '@pterodactyl/sdk/theme';
import { useBranding } from '../gobia/branding';

const schemes: { value: ThemeSchemePreference; label: string; icon: LucideIcon }[] = [
    { value: 'system', label: 'System', icon: Monitor },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'light', label: 'Light', icon: Sun },
];

/** gobia-core saves a scheme chosen here to the profile, so it follows the person to their other devices. */
const SCHEME_REQUEST_EVENT = 'gobia:scheme-request';

/** The profile menu in the top bar: Account, Appearance, Admin (administrators only), the scheme and Log out. */
export default function UserMenu({ model }: { model: AppLayoutModel }) {
    const { user, links, preference, setScheme } = model;
    const avatar = useBranding('avatar') || user.avatar;
    const appearance = useNavigation('account').items.find((item) => item.id === 'appearance');
    const account = links.find((link) => link.id === 'account');
    const admin = links.find((link) => link.id === 'admin');
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        const away = (event: MouseEvent) => {
            if (!root.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        const key = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);

        document.addEventListener('mousedown', away);
        document.addEventListener('keydown', key);

        return () => {
            document.removeEventListener('mousedown', away);
            document.removeEventListener('keydown', key);
        };
    }, [open]);

    const close = () => setOpen(false);
    const choose = (value: ThemeSchemePreference) => {
        setScheme?.(value);
        window.dispatchEvent(new CustomEvent(SCHEME_REQUEST_EVENT, { detail: value }));
    };

    return (
        <div ref={root} style={{ position: 'relative' }}>
            <button
                type='button'
                className='gb-user-btn'
                aria-haspopup='menu'
                aria-expanded={open}
                aria-label={`Account menu for ${user.username}`}
                onClick={() => setOpen((value) => !value)}
            >
                <span
                    style={{
                        display: 'block',
                        width: 30,
                        height: 30,
                        borderRadius: 999,
                        overflow: 'hidden',
                        flex: 'none',
                    }}
                >
                    <Avatar name={user.uuid} image={avatar} size={30} />
                </span>
                <span className='gb-user-name'>{user.username}</span>
                <ChevronDown aria-hidden />
            </button>
            {open && (
                <div
                    role='menu'
                    aria-label='Account'
                    className='gb-menu'
                    style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)' }}
                >
                    <div style={{ padding: '8px 10px 10px', minWidth: 240 }}>
                        <div style={{ fontWeight: 700, color: 'var(--gb-text-strong)' }}>{user.username}</div>
                        <div
                            className='gb-secondary'
                            style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                            {user.email}
                        </div>
                    </div>
                    <div className='gb-menu-sep' />
                    {account && (
                        <PanelLink
                            role='menuitem'
                            destination={account.destination}
                            className='gb-menu-item'
                            onClick={close}
                        >
                            <Settings aria-hidden /> Account
                        </PanelLink>
                    )}
                    {appearance && (
                        <PanelLink
                            role='menuitem'
                            destination={appearance.destination}
                            className='gb-menu-item'
                            onClick={close}
                        >
                            <Palette aria-hidden /> Appearance
                        </PanelLink>
                    )}
                    {admin && (
                        <PanelLink
                            role='menuitem'
                            destination={admin.destination}
                            className='gb-menu-item'
                            onClick={close}
                        >
                            <ShieldCheck aria-hidden /> Admin
                        </PanelLink>
                    )}
                    {setScheme && (
                        <>
                            <div className='gb-menu-sep' />
                            <div
                                role='group'
                                aria-label='Theme'
                                style={{ display: 'flex', gap: 4, padding: '2px 4px 6px' }}
                            >
                                {schemes.map(({ value, label, icon: Icon }) => (
                                    <button
                                        key={value}
                                        type='button'
                                        role='menuitemradio'
                                        aria-checked={preference === value}
                                        title={label}
                                        aria-label={label}
                                        onClick={() => choose(value)}
                                        className='gb-menu-item'
                                        style={{
                                            justifyContent: 'center',
                                            padding: 0,
                                            flex: 1,
                                            background: preference === value ? 'var(--gb-primary-soft)' : undefined,
                                            color: preference === value ? 'var(--gb-primary)' : undefined,
                                        }}
                                    >
                                        <Icon aria-hidden />
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                    <div className='gb-menu-sep' />
                    <button type='button' role='menuitem' className='gb-menu-item' onClick={model.signOut}>
                        <LogOut aria-hidden /> Log out
                    </button>
                </div>
            )}
        </div>
    );
}
