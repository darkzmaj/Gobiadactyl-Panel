import { useThemeSettings } from '@pterodactyl/sdk/theme';
import type { ThemeSettings } from '../theme-types';

/** Only web addresses become links, so a setting can never turn into a `javascript:` link. */
function safeLink(value: string): string | null {
    try {
        const url = new URL(value);

        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
        return null;
    }
}

/**
 * The bottom of every page: the copyright line and, smaller, the sponsor. Both are theme settings (Admin, Themes,
 * Footer); with both hidden nothing is drawn at all.
 */
export default function Footer() {
    const settings = useThemeSettings<ThemeSettings>();
    const copyright = settings.footerCopyrightShow ? settings.footerCopyright.trim() : '';
    const sponsor = settings.footerSponsorShow ? settings.footerSponsorName.trim() : '';
    const href = sponsor ? safeLink(settings.footerSponsorUrl.trim()) : null;

    if (!copyright && !sponsor) {
        return null;
    }

    return (
        <footer className='gb-footer-min'>
            {copyright && <p className='gb-footer-copyright'>{copyright}</p>}
            {sponsor && (
                <p className='gb-footer-sponsor'>
                    {settings.footerSponsorLabel.trim()}{' '}
                    {href ? (
                        <a href={href} target='_blank' rel='noopener noreferrer'>
                            {sponsor}
                        </a>
                    ) : (
                        sponsor
                    )}
                </p>
            )}
        </footer>
    );
}
