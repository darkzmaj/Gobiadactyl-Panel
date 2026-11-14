import { Button, Dialog, httpErrorToHuman, toast, usePanelNavigate } from '@pterodactyl/sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { captureServer, fetchOptions, keys } from '../api';
import { SelectField, TextField } from '../editor/fields';

const FORM = 'gt-capture';

/** Creates a template from a live server: its settings and a copy of its files, ready to review and publish. */
export default function CaptureDialog({ onClose }: { onClose: () => void }) {
    const navigate = usePanelNavigate();
    const { data } = useQuery({ queryKey: keys.options, queryFn: fetchOptions });
    const [server, setServer] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [exclude, setExclude] = useState('logs, cache, crash-reports');

    const capture = useMutation({
        mutationFn: () =>
            captureServer({
                server: server ?? '',
                name: name.trim(),
                exclude: exclude
                    .split(',')
                    .map((path) => path.trim())
                    .filter(Boolean),
            }),
        onSuccess: (result) => {
            const skipped = result.skipped.length > 0 ? ` ${result.skipped.length} skipped.` : '';
            toast.success(
                `Template created with ${result.files} files.${skipped} It is disabled until you publish and enable it.`
            );
            void navigate({
                extension: 'gobia-templates',
                screen: 'editor',
                params: { template: String(result.template.template.id) },
            });
        },
        onError: (error: Error) => toast.error(httpErrorToHuman(error)),
    });

    const ready = server !== null && name.trim() !== '' && !capture.isPending;
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (ready) capture.mutate();
    };

    return (
        <Dialog
            open
            onClose={capture.isPending ? () => {} : onClose}
            title={'Template from a server'}
            description={'Copies the software, image, startup, resources, variables and files of a live server.'}
        >
            <form id={FORM} onSubmit={submit} noValidate style={{ display: 'grid', gap: 16, paddingBottom: 4 }}>
                <SelectField
                    label={'Server'}
                    value={server}
                    onChange={(uuid) => {
                        setServer(uuid);
                        if (name.trim() === '') setName(data?.servers.find((row) => row.uuid === uuid)?.name ?? '');
                    }}
                    options={(data?.servers ?? []).map((row) => ({ value: row.uuid, label: row.name }))}
                    empty={'Choose a server'}
                />
                <TextField label={'Template name'} value={name} onChange={setName} />
                <TextField
                    label={'Leave out'}
                    hint={
                        'Folders or files, relative to the server root and separated by commas (for example world, logs).'
                    }
                    value={exclude}
                    onChange={setExclude}
                />
                <p className={'gb-hint'}>
                    Stop the server first for a consistent copy of worlds and databases. Symbolic links and files that
                    may hold secrets (.env, forwarding.secret, config/paper-global.yml) are not copied.
                </p>
            </form>
            <Dialog.Footer>
                <Button.Text type={'button'} onClick={onClose} disabled={capture.isPending}>
                    Cancel
                </Button.Text>
                <Button type={'submit'} form={FORM} color={'primary'} isLoading={capture.isPending} disabled={!ready}>
                    Create template
                </Button>
            </Dialog.Footer>
        </Dialog>
    );
}
