import { Button, httpErrorToHuman, http, toast } from '@pterodactyl/sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { keys, type DetailResponse, type InstanceRow } from '../api';

const ADMIN = '/api/admin/extensions/gobia-templates';

const SYNC_LABEL = {
    syncing: 'Syncing',
    synced: 'Synced',
    rolled_back: 'Rolled back',
    failed: 'Sync failed',
} satisfies Record<NonNullable<InstanceRow['sync_state']>, string>;

export default function InstancesTab({ id, detail }: { id: number; detail: DetailResponse }) {
    const queryClient = useQueryClient();
    const refresh = () => queryClient.invalidateQueries({ queryKey: keys.detail(id) });
    const fail = (error: Error) => toast.error(httpErrorToHuman(error));
    const retry = useMutation({
        mutationFn: (instance: string) => http.post(`${ADMIN}/templates/${id}/instances/${instance}/retry`),
        onSuccess: async () => {
            await refresh();
            toast.success('The instance was queued again.');
        },
        onError: fail,
    });
    const follow = useMutation({
        mutationFn: ({ instance, value }: { instance: string; value: boolean }) =>
            http.post(`${ADMIN}/templates/${id}/instances/${instance}/follow`, { follow: value }),
        onSuccess: refresh,
        onError: fail,
    });
    const sync = useMutation({
        mutationFn: () => http.post(`${ADMIN}/templates/${id}/sync`),
        onSuccess: async () => {
            await refresh();
            toast.success('Following servers are being updated one at a time.');
        },
        onError: fail,
    });

    const paths = detail.template.sync_paths ?? [];
    const current = detail.template.revision;

    return (
        <div>
            <section aria-label={'Following'} className={'gt:mb-6'}>
                <h2 className={'gt:mb-2 gt:text-sm gt:font-semibold gt:uppercase gt:text-muted-foreground'}>
                    Following
                </h2>
                <p className={'gt:mb-3 gt:text-sm gt:text-muted-foreground'}>
                    {paths.length === 0
                        ? 'Nothing syncs yet: add synced paths on the Lifecycle tab.'
                        : `Servers that follow this template receive every new revision of ${paths.join(', ')}. Running servers are restarted one at a time and rolled back if they do not come back.`}
                </p>
                <Button
                    type={'button'}
                    disabled={paths.length === 0 || !detail.instances.some((instance) => instance.follow)}
                    isLoading={sync.isPending}
                    onClick={() => sync.mutate()}
                >
                    Sync now
                </Button>
            </section>
            <section aria-label={'Instances'}>
                <h2 className={'gt:mb-2 gt:text-sm gt:font-semibold gt:uppercase gt:text-muted-foreground'}>
                    Latest instances
                </h2>
                <ul className={'gt:flex gt:flex-col gt:gap-2'}>
                    {detail.instances.map((instance) => (
                        <li
                            key={instance.id}
                            className={
                                'gt:flex gt:flex-wrap gt:items-center gt:justify-between gt:gap-3 gt:rounded-lg gt:border gt:border-border gt:p-3 gt:text-sm'
                            }
                        >
                            <div>
                                <p className={'gt:font-medium'}>{instance.name}</p>
                                <p className={'gt:text-xs gt:text-muted-foreground'}>
                                    {instance.state.replace('_', ' ')}
                                    {instance.failed_stage && ` at ${instance.failed_stage.replace('_', ' ')}`}
                                    {instance.error && `: ${instance.error}`}
                                </p>
                                {instance.state === 'ready' && (
                                    <p className={'gt:text-xs gt:text-muted-foreground'}>
                                        Revision {instance.revision}
                                        {instance.revision < current && instance.follow && ` (current is ${current})`}
                                        {instance.sync_state && ` · ${SYNC_LABEL[instance.sync_state]}`}
                                        {instance.sync_error && `: ${instance.sync_error}`}
                                    </p>
                                )}
                            </div>
                            <div className={'gt:flex gt:gap-2'}>
                                {instance.state === 'ready' && (
                                    <Button.Text
                                        type={'button'}
                                        aria-pressed={instance.follow}
                                        disabled={follow.isPending && follow.variables?.instance === instance.id}
                                        onClick={() =>
                                            follow.mutate({ instance: instance.id, value: !instance.follow })
                                        }
                                    >
                                        {instance.follow ? 'Stop following' : 'Follow'}
                                    </Button.Text>
                                )}
                                {instance.state === 'failed' && (
                                    <Button
                                        type={'button'}
                                        isLoading={retry.isPending && retry.variables === instance.id}
                                        onClick={() => retry.mutate(instance.id)}
                                    >
                                        Retry
                                    </Button>
                                )}
                            </div>
                        </li>
                    ))}
                    {detail.instances.length === 0 && (
                        <li className={'gt:text-sm gt:text-muted-foreground'}>
                            No instances yet. Create one from the dashboard with Create instance.
                        </li>
                    )}
                </ul>
            </section>
        </div>
    );
}
