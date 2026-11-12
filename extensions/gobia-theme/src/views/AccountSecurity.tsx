import { Alert, PageContentBlock, PageHeading } from '@pterodactyl/sdk';
import { Slot, View, type ViewProps } from '@pterodactyl/sdk/theme';

/**
 * The stock account overview is Security in the Gobia account menu: the same blocks, laid out to fit beside the menu
 * (one column, two from extra large screens) instead of classic's three full-width columns.
 */
export default function AccountSecurity({ model, className }: ViewProps<'page.account.overview'>) {
    return (
        <PageContentBlock title='Security' className={className}>
            <PageHeading title='Security' description='Your password, email address and two-step verification.' />
            {model.twoFactorRequired && (
                <Alert title='Two-step verification required' type='danger' className='mb-4'>
                    Your account must have two-step verification enabled in order to continue.
                </Alert>
            )}
            <Slot name='account.overview.before' />
            <div className='grid grid-cols-1 gap-4 xl:grid-cols-2'>
                <View name='account.password' />
                <View name='account.email' />
                <View name='account.twoFactor' />
                {model.userAvatarsEnabled && <View name='account.avatar' />}
            </div>
            <Slot name='account.overview.after' />
        </PageContentBlock>
    );
}
