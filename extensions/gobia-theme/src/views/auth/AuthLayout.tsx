import { Main, type ViewProps } from '@pterodactyl/sdk/theme';
import { DEFAULT_LOGO, DEFAULT_LOGO_2X, useBranding } from '../../gobia/branding';
import AuthPreview from './AuthPreview';

/**
 * The frame of every sign-in page: a pitch with a live looking preview of the instance list on the left, the logo and
 * the page's card on the right. No footer, and the pitch is hidden on phones. Rendered before anything else, so it
 * stays in the theme entry and imports nothing from `@pterodactyl/sdk` itself.
 */
export default function AuthLayout({ model, children }: ViewProps<'layout.auth'>) {
    const uploaded = useBranding('logo') || model.brand.logoUrl;

    return (
        <div className='gb-auth'>
            <div className='gb-auth-split'>
                <section className='gb-auth-pitch'>
                    <div>
                        <h2>Your servers, wherever you are.</h2>
                        <p>Start, watch and manage every instance from one place.</p>
                        <AuthPreview />
                    </div>
                </section>
                <Main className='gb-auth-main'>
                    <div className='gb-auth-column'>
                        <div className='gb-auth-logo'>
                            <img
                                src={uploaded || DEFAULT_LOGO}
                                srcSet={uploaded ? undefined : `${DEFAULT_LOGO} 1x, ${DEFAULT_LOGO_2X} 2x`}
                                alt={model.brand.name}
                            />
                        </div>
                        {children}
                    </div>
                </Main>
            </div>
        </div>
    );
}
