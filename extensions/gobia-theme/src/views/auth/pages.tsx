import { useId, type ReactNode } from 'react';
import { Button, Form, Input, Label, PanelLink, type FieldModel } from '@pterodactyl/sdk';
import { Slot, type ViewProps } from '@pterodactyl/sdk/theme';

const linkClass = 'text-sm text-muted-foreground no-underline hover:text-foreground';

/** The Gobia sign-in card: title, one line of context, the form. The frame (logo, pitch) is layout.auth. */
function AuthCard({
    title,
    subtitle,
    submit,
    className,
    children,
}: {
    title: string;
    subtitle?: string;
    submit: () => void;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={`gb-auth-box${className ? ` ${className}` : ''}`}>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
            <Form form={{ handleSubmit: submit }} className='w-full flex'>
                <div className='w-full'>{children}</div>
            </Form>
        </div>
    );
}

/** Label, input and help text for an engine field (the same contract as classic's sign-in fields). */
function TextField({
    field,
    label,
    description,
    title,
    autoFocus,
}: {
    field: FieldModel;
    label?: string;
    description?: string;
    title?: string;
    autoFocus?: boolean;
}) {
    const id = useId();
    const helpId = `${id}-help`;
    const help = field.error ?? description;

    return (
        <div>
            {label && (
                <Label htmlFor={id} isLight>
                    {label}
                </Label>
            )}
            <Input
                {...field.fieldProps}
                id={id}
                title={title}
                autoFocus={autoFocus}
                aria-invalid={field.error ? true : undefined}
                aria-describedby={help ? helpId : undefined}
                $hasError={!!field.error}
                $isLight
            />
            {help && (
                <p id={helpId} className={`input-help${field.error ? ' error' : ''}`}>
                    {help}
                </p>
            )}
        </div>
    );
}

export function LoginPage({ model, className }: ViewProps<'page.auth.login'>) {
    const { fields, Captcha } = model;

    return (
        <AuthCard title='Login' subtitle='Sign in to your Gobia account.' submit={model.submit} className={className}>
            <TextField field={fields.username} label='Email' />
            <div className='mt-6'>
                <TextField field={fields.password} label='Password' />
            </div>
            <div className='mt-6'>
                <Button type='submit' size='xlarge' disabled={!model.canSubmit} isLoading={model.submitting}>
                    Login
                </Button>
            </div>
            <Slot name='auth.login.form.after' data={model.route} />
            {Captcha && <Captcha />}
            <div className='mt-6 text-center'>
                <PanelLink destination={model.forgotPassword} className={linkClass}>
                    Forgot password?
                </PanelLink>
            </div>
        </AuthCard>
    );
}

export function CheckpointPage({ model, className }: ViewProps<'page.auth.checkpoint'>) {
    const { recovery } = model;

    return (
        <AuthCard
            title='Two-step verification'
            subtitle={recovery ? 'Enter one of your recovery codes.' : 'Enter the code from your authenticator app.'}
            submit={model.submit}
            className={className}
        >
            <TextField
                field={model.fields.code}
                label={recovery ? 'Recovery code' : 'Authentication code'}
                title={recovery ? 'Recovery Code' : 'Authentication Code'}
                autoFocus
            />
            <div className='mt-6'>
                <Button type='submit' size='xlarge' disabled={!model.canSubmit} isLoading={model.submitting}>
                    Continue
                </Button>
            </div>
            <div className='mt-6 text-center'>
                <button
                    type='button'
                    onClick={model.toggleRecovery}
                    className={`cursor-pointer appearance-none border-0 bg-transparent p-0 ${linkClass}`}
                >
                    {recovery ? 'I have my device' : "I've lost my device"}
                </button>
            </div>
            <div className='mt-4 text-center'>
                <PanelLink destination={model.login} className={linkClass}>
                    Return to login
                </PanelLink>
            </div>
        </AuthCard>
    );
}

export function ForgotPasswordPage({ model, className }: ViewProps<'page.auth.password'>) {
    const { Captcha } = model;

    return (
        <AuthCard
            title='Reset password'
            subtitle='Enter your account email address and we will send you a link to reset your password.'
            submit={model.submit}
            className={className}
        >
            <TextField field={model.fields.email} label='Email' />
            <div className='mt-6'>
                <Button type='submit' size='xlarge' disabled={!model.canSubmit} isLoading={model.submitting}>
                    Send email
                </Button>
            </div>
            {Captcha && <Captcha />}
            <div className='mt-6 text-center'>
                <PanelLink destination={model.login} className={linkClass}>
                    Return to login
                </PanelLink>
            </div>
        </AuthCard>
    );
}

export function ResetPasswordPage({ model, className }: ViewProps<'page.auth.passwordReset'>) {
    const { fields, Captcha } = model;

    return (
        <AuthCard title='Choose a new password' submit={model.submit} className={className}>
            <div>
                <Label htmlFor='password-reset-email' isLight>
                    Email
                </Label>
                <Input id='password-reset-email' value={model.email} $isLight disabled />
            </div>
            <div className='mt-6'>
                <TextField field={fields.password} label='New password' description='At least 8 characters.' />
            </div>
            <div className='mt-6'>
                <TextField field={fields.passwordConfirmation} label='Confirm new password' />
            </div>
            <div className='mt-6'>
                <Button type='submit' size='xlarge' disabled={!model.canSubmit} isLoading={model.submitting}>
                    Reset password
                </Button>
            </div>
            {Captcha && <Captcha />}
            <div className='mt-6 text-center'>
                <PanelLink destination={model.login} className={linkClass}>
                    Return to login
                </PanelLink>
            </div>
        </AuthCard>
    );
}
