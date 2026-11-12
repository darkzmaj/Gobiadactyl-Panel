import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, Search } from 'lucide-react';
import {
    bytesToString,
    http,
    queryClient,
    serverQueryOptions,
    serverResourcesQueryOptions,
    usePanelLocation,
    usePanelNavigate,
} from '@pterodactyl/sdk';
import type { ServerArea } from '@pterodactyl/sdk/theme';
import StatusDots from '../gobia/StatusDots';
import { levelOf, modeOf } from '../gobia/statusLevels';
import { useLiveStats } from '../gobia/liveStats';

const MIB = 1024 * 1024;
/** Only the first few rows look up their power state, so opening the list never fans out into dozens of requests. */
const POWER_LOOKUPS = 8;

interface ListedServer {
    identifier: string;
    uuid: string;
    name: string;
    node: string;
    description: string | null;
    is_suspended: boolean;
    status: string | null;
}

/** The permission each server page needs (the routes of the panel); a page not listed needs none. */
const pagePermissions = new Map<string, string[]>(
    Object.entries({
        files: ['file.*'],
        databases: ['database.*'],
        schedules: ['schedule.*'],
        backups: ['backup.*'],
        ports: ['allocation.*'],
        settings: ['settings.*', 'file.sftp', 'startup.*'],
        'settings/startup': ['startup.*'],
        activity: ['activity.*'],
    })
);
const pageOrder = ['', 'files', 'databases', 'schedules', 'backups', 'ports', 'settings', 'activity'];

const holds = (granted: readonly string[], permission: string) =>
    granted.some(
        (held) =>
            held === '*' ||
            held === permission ||
            (permission.endsWith('.*') && held.startsWith(permission.slice(0, -1))) ||
            (held.endsWith('.*') && permission.startsWith(held.slice(0, -1)))
    );
const mayOpen = (granted: readonly string[], page: string) =>
    (pagePermissions.get(page) ?? []).length === 0 ||
    (pagePermissions.get(page) ?? []).some((permission) => holds(granted, permission));

function Row({
    server,
    id,
    active,
    withPower,
    onPick,
}: {
    server: ListedServer;
    id: string;
    active: boolean;
    withPower: boolean;
    onPick: () => void;
}) {
    const power = useQuery({ ...serverResourcesQueryOptions(server.uuid), enabled: withPower, staleTime: 10_000 });
    const state = power.data?.attributes.current_state ?? null;
    let note = '';

    if (server.is_suspended) {
        note = 'Suspended';
    } else if (server.status === 'installing') {
        note = 'Installing';
    } else if (state) {
        note = state === 'running' ? 'Online' : 'Offline';
    }

    return (
        <li
            id={id}
            role='option'
            aria-selected={active}
            className={`gb-picker-item${active ? ' active' : ''}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onPick}
        >
            <span className={`gb-sdot ${state === 'running' ? 'ok' : 'idle'}`} aria-hidden />
            <span className='gb-picker-text'>
                <strong>{server.name}</strong>
                <small>
                    {server.node}
                    {server.description ? ` · ${server.description}` : ''}
                </small>
            </span>
            <span className='gb-picker-state'>{note}</span>
        </li>
    );
}

/**
 * The instance card of the sidebar: name, node, four status dots, and a searchable list of every instance the person
 * can open. Choosing one keeps the page (Files stays Files); where the person may not open that page on the other
 * instance, its first page they may open is shown instead.
 */
export default function ServerCard({ area }: { area: ServerArea }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [highlight, setHighlight] = useState(0);
    const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const popover = useRef<HTMLDivElement>(null);
    const listId = useId();
    const navigate = usePanelNavigate();
    const { pathname } = usePanelLocation();
    const live = useLiveStats(area.uuid);
    const limits = area.server.attributes.limits;
    // Only root administrators get the server's admin page link.
    const admin = area.adminLink !== null;
    const list = useQuery({
        queryKey: ['gobia-theme', 'instances', search, admin],
        queryFn: async () =>
            (
                await http.get<{ data: { attributes: ListedServer }[] }>('/api/client', {
                    // Nothing is hidden from an administrator: the list holds every instance, as the instance list does.
                    // Axios leaves out parameters that are undefined.
                    params: {
                        'filter[*]': search || undefined,
                        type: admin ? 'admin-all' : undefined,
                        per_page: 50,
                    },
                })
            ).data.data.map((row) => row.attributes),
        enabled: open,
        staleTime: 15_000,
    });
    const items = list.data ?? [];

    useLayoutEffect(() => {
        if (!open || !trigger.current) {
            return;
        }

        const rect = trigger.current.getBoundingClientRect();
        const width = Math.max(rect.width, 300);

        setBox({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: rect.bottom + 6, width });
    }, [open]);
    useEffect(() => {
        if (!open) {
            return;
        }

        const away = (event: MouseEvent) => {
            const target = event.target as Node;

            if (!popover.current?.contains(target) && !trigger.current?.contains(target)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', away);

        return () => document.removeEventListener('mousedown', away);
    }, [open]);
    useEffect(() => setHighlight(0), [search, open]);

    const choose = async (server: ListedServer) => {
        setOpen(false);
        setSearch('');
        if (server.identifier === area.identifier) {
            return;
        }

        const rest = pathname.replace(new RegExp(`^/server/${area.identifier}/?`), '').split('/');
        const page = rest[0] === 'settings' && rest[1] === 'startup' ? 'settings/startup' : (rest[0] ?? '');
        let target = page;

        try {
            const loaded = await queryClient.ensureQueryData(serverQueryOptions(server.identifier));
            const granted = loaded.meta?.user_permissions ?? [];

            if (!mayOpen(granted, page)) {
                target =
                    page === 'settings/startup' && mayOpen(granted, 'settings')
                        ? 'settings'
                        : (pageOrder.find((candidate) => mayOpen(granted, candidate)) ?? '');
            }
        } catch {
            // The page decides what to show when the permissions could not be read.
        }

        await navigate({ to: `/server/${server.identifier}${target ? `/${target}` : ''}` } as never);
    };

    return (
        <>
            <button
                ref={trigger}
                type='button'
                className='gb-subcard gb-switcher'
                aria-haspopup='listbox'
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
            >
                <span className='sr-only'>Switch instance: </span>
                <StatusDots
                    vertical
                    mode={modeOf(area.state, null)}
                    seed={area.uuid}
                    powerLabel={area.state ?? 'offline'}
                    cpu={{ level: levelOf(live?.cpu ?? null, limits.cpu), text: `${Math.round(live?.cpu ?? 0)}%` }}
                    memory={{
                        level: levelOf(live?.memory ?? null, limits.memory * MIB),
                        text: bytesToString(live?.memory ?? 0),
                    }}
                    disk={{
                        level: levelOf(live?.disk ?? null, limits.disk * MIB),
                        text: bytesToString(live?.disk ?? 0),
                    }}
                />
                <span style={{ minWidth: 0 }}>
                    <strong
                        style={{
                            display: 'block',
                            color: 'var(--gb-text-strong)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {area.name}
                    </strong>
                    <span className='gb-secondary' style={{ fontSize: 12 }}>
                        {area.server.attributes.node} · {area.state ?? 'offline'}
                    </span>
                </span>
                <ChevronsUpDown className='gb-switcher-chevron' aria-hidden />
            </button>
            {open &&
                box &&
                createPortal(
                    <div
                        ref={popover}
                        className='gb-picker-pop'
                        style={{ left: box.left, top: box.top, width: box.width }}
                        role='dialog'
                        aria-label='Switch instance'
                    >
                        <label className='gb-picker-search'>
                            <Search aria-hidden />
                            <input
                                autoFocus
                                value={search}
                                placeholder='Search instances'
                                aria-label='Search instances'
                                role='combobox'
                                aria-expanded
                                aria-controls={listId}
                                aria-activedescendant={items[highlight] ? `${listId}-${highlight}` : undefined}
                                onChange={(event) => setSearch(event.currentTarget.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'ArrowDown') {
                                        event.preventDefault();
                                        setHighlight((index) => Math.min(items.length - 1, index + 1));
                                    } else if (event.key === 'ArrowUp') {
                                        event.preventDefault();
                                        setHighlight((index) => Math.max(0, index - 1));
                                    } else if (event.key === 'Enter') {
                                        event.preventDefault();
                                        const picked = items[highlight];

                                        if (picked) {
                                            void choose(picked);
                                        }
                                    } else if (event.key === 'Escape') {
                                        setOpen(false);
                                        trigger.current?.focus();
                                    }
                                }}
                            />
                        </label>
                        <ul id={listId} role='listbox' aria-label='Instances' className='gb-picker-list'>
                            {items.map((server, index) => (
                                <Row
                                    key={server.uuid}
                                    id={`${listId}-${index}`}
                                    server={server}
                                    active={index === highlight}
                                    withPower={index < POWER_LOOKUPS}
                                    onPick={() => void choose(server)}
                                />
                            ))}
                            {list.data && items.length === 0 && (
                                <li className='gb-picker-empty'>No instance matches.</li>
                            )}
                            {!list.data && <li className='gb-picker-empty'>Loading instances…</li>}
                        </ul>
                    </div>,
                    document.body
                )}
        </>
    );
}
