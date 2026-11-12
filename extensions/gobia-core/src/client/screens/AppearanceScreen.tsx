import { ContentBox, PageContentBlock, toast } from '@pterodactyl/sdk';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderTree, List, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTheme } from '@pterodactyl/sdk/theme';
import { FILE_EDITORS, publishFileEditor, SCHEMES, type FileEditor, type Scheme } from '../appearance';
import { fetchProfile, profileQueryKey, saveAppearance, saveFileEditor } from '../api';

const OPTIONS = {
    system: { label: 'System', text: 'Match your device. Switches automatically at night.', icon: Monitor },
    dark: { label: 'Dark', text: 'Easy on the eyes in low light.', icon: Moon },
    light: { label: 'Light', text: 'Bright and crisp for well-lit rooms.', icon: Sun },
} satisfies Record<Scheme, { label: string; text: string; icon: LucideIcon }>;

const EDITORS = {
    gobia: {
        label: 'Gobia workspace',
        text: 'Explorer, tabs, two servers side by side, search and replace.',
        icon: FolderTree,
    },
    legacy: {
        label: 'Legacy',
        text: 'The classic file list; files open on their own page in the same editor.',
        icon: List,
    },
} satisfies Record<FileEditor, { label: string; text: string; icon: LucideIcon }>;

export default function AppearanceScreen() {
    const queryClient = useQueryClient();
    const { setScheme } = useTheme();
    const { data } = useQuery({ queryKey: profileQueryKey, queryFn: fetchProfile, staleTime: Infinity });
    const selected = data?.theme ?? 'system';
    const mutation = useMutation({
        mutationFn: saveAppearance,
        onSuccess: (profile) => {
            queryClient.setQueryData(profileQueryKey, profile);
            setScheme(profile.theme);
        },
        onError: () => toast.error('Could not save your appearance.'),
    });
    const editor = data?.file_editor ?? 'gobia';
    const editorMutation = useMutation({
        mutationFn: saveFileEditor,
        onSuccess: (profile) => {
            queryClient.setQueryData(profileQueryKey, profile);
            publishFileEditor(profile.file_editor);
        },
        onError: () => toast.error('Could not save your file editor.'),
    });

    return (
        <PageContentBlock title={'Appearance'}>
            <div className={'gb-page-head'}>
                <div style={{ minWidth: 0 }}>
                    <h1>Appearance</h1>
                    <p>Choose how the Panel looks. Your choice follows you to every device.</p>
                </div>
            </div>
            <ContentBox title={'Theme'}>
                <p className={'gb-card-sub'}>System follows your operating system setting.</p>
                <div
                    role={'radiogroup'}
                    aria-label={'Theme'}
                    style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}
                >
                    {SCHEMES.map((scheme) => {
                        const { label, text, icon: Icon } = OPTIONS[scheme];

                        return (
                            <button
                                key={scheme}
                                type={'button'}
                                role={'radio'}
                                aria-checked={selected === scheme}
                                disabled={mutation.isPending}
                                className={'gb-option' + (selected === scheme ? ' selected' : '')}
                                style={{ alignItems: 'flex-start', marginTop: 0 }}
                                onClick={() => mutation.mutate(scheme)}
                            >
                                <span className={'gb-file-icon'}>
                                    <Icon aria-hidden />
                                </span>
                                <span>
                                    <strong>{label}</strong>
                                    <span>{text}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </ContentBox>
            <ContentBox title={'File editor'} className={'mt-4'}>
                <p className={'gb-card-sub'}>How server files open. Both use the same code editor.</p>
                <div
                    role={'radiogroup'}
                    aria-label={'File editor'}
                    style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}
                >
                    {FILE_EDITORS.map((value) => {
                        const { label, text, icon: Icon } = EDITORS[value];

                        return (
                            <button
                                key={value}
                                type={'button'}
                                role={'radio'}
                                aria-checked={editor === value}
                                disabled={editorMutation.isPending}
                                className={'gb-option' + (editor === value ? ' selected' : '')}
                                style={{ alignItems: 'flex-start', marginTop: 0 }}
                                onClick={() => editorMutation.mutate(value)}
                            >
                                <span className={'gb-file-icon'}>
                                    <Icon aria-hidden />
                                </span>
                                <span>
                                    <strong>{label}</strong>
                                    <span>{text}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </ContentBox>
        </PageContentBlock>
    );
}
