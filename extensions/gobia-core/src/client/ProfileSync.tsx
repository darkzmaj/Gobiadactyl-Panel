import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTheme } from '@pterodactyl/sdk/theme';
import { parseScheme, SCHEME_REQUEST_EVENT } from './appearance';
import { applyAvatar } from './branding';
import { fetchProfile, profileQueryKey, saveAppearance } from './api';

/**
 * Headless: applies the signed in user's saved scheme and avatar, and saves a scheme chosen from the Gobia theme's
 * profile menu. Rendered in the authenticated navigation.
 */
export default function ProfileSync() {
    const { data } = useQuery({ queryKey: profileQueryKey, queryFn: fetchProfile, staleTime: Infinity });
    const queryClient = useQueryClient();
    const { setScheme } = useTheme();
    const theme = data?.theme;
    const avatar = data?.avatar_url ?? null;
    const save = useMutation({
        mutationFn: saveAppearance,
        onSuccess: (profile) => queryClient.setQueryData(profileQueryKey, profile),
    });
    const { mutate } = save;

    useEffect(() => {
        if (theme) {
            setScheme(theme);
        }
    }, [theme, setScheme]);

    useEffect(() => {
        const onRequest = (event: Event) => mutate(parseScheme(String((event as CustomEvent<unknown>).detail)));

        window.addEventListener(SCHEME_REQUEST_EVENT, onRequest);

        return () => window.removeEventListener(SCHEME_REQUEST_EVENT, onRequest);
    }, [mutate]);

    useEffect(() => {
        if (data) {
            applyAvatar(avatar);
        }
    }, [data, avatar]);

    return null;
}
