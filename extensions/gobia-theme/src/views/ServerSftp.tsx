import { Button, Card, CopyOnClick, Input, ip, Label } from '@pterodactyl/sdk';
import type { ViewProps } from '@pterodactyl/sdk/theme';

/** Classic's SFTP details, with each read-only field tied to its label (axe: label). */
export default function ServerSftp({ model, className }: ViewProps<'server.sftp'>) {
    if (!model.allowed) {
        return null;
    }

    const host = `${ip(model.ip)}:${model.port}`;

    return (
        <Card title='SFTP Details' className={className}>
            <div>
                <Label htmlFor='gobia-sftp-address'>Server Address</Label>
                <CopyOnClick text={`sftp://${host}`}>
                    <Input id='gobia-sftp-address' type='text' value={`sftp://${host}`} readOnly />
                </CopyOnClick>
            </div>
            <div className='mt-6'>
                <Label htmlFor='gobia-sftp-username'>Username</Label>
                <CopyOnClick text={model.username}>
                    <Input id='gobia-sftp-username' type='text' value={model.username} readOnly />
                </CopyOnClick>
            </div>
            <div className='mt-6 flex items-center'>
                <div className='flex-1'>
                    <div className='border-l-4 border-accent p-3'>
                        <p className='text-xs text-foreground'>
                            Your SFTP password is the same as the password you use to access this panel.
                        </p>
                    </div>
                </div>
                <div className='ml-4'>
                    <a href={`sftp://${model.username}@${host}`}>
                        <Button.Text isSecondary>Launch SFTP</Button.Text>
                    </a>
                </div>
            </div>
        </Card>
    );
}
