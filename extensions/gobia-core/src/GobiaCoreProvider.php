<?php

declare(strict_types=1);

namespace GobiaCore;

use GobiaCore\Actions\GuardedCreateServer;
use GobiaCore\Actions\GuardedUpdateServerBuild;
use GobiaCore\Console\ImportLegacyCommand;
use GobiaCore\Console\UpdateCommands;
use GobiaCore\Services\ResourceGuard;
use GobiaCore\Updater\Exceptions\UpdateException;
use GobiaCore\Updater\ProcessRunner;
use GobiaCore\Updater\Providers\DirectoryReleaseProvider;
use GobiaCore\Updater\Providers\GitHubReleaseProvider;
use GobiaCore\Updater\Providers\ReleaseProvider;
use GobiaCore\Updater\ReleaseVerifier;
use GobiaCore\Updater\Runners\DeploymentRunner;
use GobiaCore\Updater\Runners\ImageRunner;
use GobiaCore\Updater\Runners\InPlaceRunner;
use GobiaCore\Updater\Runners\ReleaseDirectoryRunner;
use GobiaCore\Updater\RunStore;
use GobiaCore\Updater\SafeTarExtractor;
use Illuminate\Foundation\Http\Middleware\PreventRequestsDuringMaintenance;
use Illuminate\Support\Facades\Event;
use Pterodactyl\Contracts\Servers\CreatesServers;
use Pterodactyl\Contracts\Servers\UpdatesServerBuild;
use Pterodactyl\Events\Extensions\ExtensionDisabled;
use Pterodactyl\Events\Extensions\ExtensionEnabled;
use Pterodactyl\Extensions\ExtensionProvider;
use Pterodactyl\Services\Extensions\ExtensionSettingDefinition;
use Pterodactyl\Services\Extensions\ExtensionSettingsDefinition;

class GobiaCoreProvider extends ExtensionProvider
{
    /** Gobia brand images are static files in public/gobia/img (tracked, so every release ships them). */
    public const string DEFAULT_LOGO = '/gobia/img/icon-256.png';

    public const string DEFAULT_FAVICON = '/gobia/img/favicon-32.png';

    public const string DEFAULT_FAVICON_ICO = '/gobia/img/favicon.ico';

    public const string DEFAULT_CONSOLE_PROMPT = 'panel@gobia~';

    public function register(): void
    {
        $this->mergeConfigFrom($this->extensionPath('config', 'gobia_updater.php'), 'gobia_updater');

        $this->app->singleton(RunStore::class, fn (): RunStore => new RunStore((string) config('gobia_updater.state_path')));
        $this->app->singleton(ProcessRunner::class);
        $this->app->singleton(ReleaseVerifier::class, fn (): ReleaseVerifier => new ReleaseVerifier(
            config('gobia_updater.public_key') ?: null,
            (bool) config('gobia_updater.allow_unsigned'),
        ));
        $this->app->singleton(SafeTarExtractor::class, fn (): SafeTarExtractor => new SafeTarExtractor(
            (int) config('gobia_updater.max_extracted_bytes'),
            (int) config('gobia_updater.max_archive_entries'),
        ));

        // The source and the way code goes live are chosen by the operator. There is deliberately no way to pick them per request.
        $this->app->singleton(ReleaseProvider::class, fn (): ReleaseProvider => match (config('gobia_updater.provider')) {
            'github' => new GitHubReleaseProvider(
                (string) config('gobia_updater.repository'),
                config('gobia_updater.github_token') ?: null,
                (int) config('gobia_updater.max_download_bytes'),
                (bool) config('gobia_updater.prerelease'),
            ),
            'directory' => new DirectoryReleaseProvider((string) config('gobia_updater.directory'), (bool) config('gobia_updater.prerelease')),
            default => throw new UpdateException('The configured update provider is not supported.'),
        });
        $this->app->singleton(DeploymentRunner::class, fn ($app): DeploymentRunner => match (config('gobia_updater.runner')) {
            'image' => new ImageRunner($app->make(ProcessRunner::class)),
            'in-place' => new InPlaceRunner($app->make(ProcessRunner::class), null, config('gobia_updater.helper') ?: null),
            'release-directory' => new ReleaseDirectoryRunner(
                $app->make(ProcessRunner::class),
                (string) config('gobia_updater.install_root'),
                (string) config('gobia_updater.helper'),
            ),
            default => throw new UpdateException('The configured update runner is not supported.'),
        });
    }

    public function boot(): void
    {
        // The resource protector around every server creation and build change, whoever calls it (it does nothing while off).
        $this->wrapAction(CreatesServers::class, fn (CreatesServers $inner): CreatesServers => new GuardedCreateServer($inner, $this->app->make(ResourceGuard::class)));
        $this->wrapAction(UpdatesServerBuild::class, fn (UpdatesServerBuild $inner): UpdatesServerBuild => new GuardedUpdateServerBuild($inner, $this->app->make(ResourceGuard::class)));
        $this->registerApiRoutes();
        $this->loadExtensionMigrations();
        $this->registerCommands([ImportLegacyCommand::class, ...UpdateCommands::ALL]);
        // The Updates screen keeps polling this while the Panel is in maintenance mode for the update. It still needs an administrator session.
        PreventRequestsDuringMaintenance::except(['api/admin/extensions/gobia-core/updates/progress/*']);
        // The Panel deletes its route snapshot whenever an extension is enabled or disabled. Where snapshots are
        // in use (the updater builds them), build a new one in the background instead of running without it.
        if ($this->app->routesAreCached()) {
            Event::listen([ExtensionEnabled::class, ExtensionDisabled::class], function (): void {
                rescue(fn () => ProcessRunner::detachArtisan('route:cache'), report: false);
            });
        }
        $definition = new ExtensionSettingsDefinition($this->settings(), [
            ExtensionSettingDefinition::make('logo', 'logo', self::DEFAULT_LOGO)
                ->label('Logo')
                ->help('PNG shown in the top bar instead of the Gobia wordmark. Leave empty to use the Gobia logo.')
                ->tab('Branding')
                ->file(['image/png'], 1024)
                ->frontend()
                ->public(),
            ExtensionSettingDefinition::make('favicon', 'favicon', self::DEFAULT_FAVICON)
                ->label('Favicon')
                ->help('PNG used as the browser tab icon. Leave empty to use the Gobia icon.')
                ->tab('Branding')
                ->file(['image/png'], 256)
                ->frontend()
                ->public(),
            ExtensionSettingDefinition::make('console_prompt', 'console_prompt', self::DEFAULT_CONSOLE_PROMPT, ['nullable', 'string', 'max:40'])
                ->label('Console prompt')
                ->help('Shown in blue in front of the panel\'s own lines in a server console. Leave empty for "panel@gobia~".')
                ->tab('Branding')
                ->frontend(),
            ExtensionSettingDefinition::make(ResourceGuard::ENABLED, ResourceGuard::ENABLED, false, ['boolean'])
                ->label('Resource protector')
                ->help('Refuse to create or grow an instance when the memory or storage allocated across all nodes would eat into the reserve below.')
                ->tab('Resources')
                ->field('toggle'),
            ExtensionSettingDefinition::make(ResourceGuard::RESERVE, ResourceGuard::RESERVE, ResourceGuard::DEFAULT_RESERVE, ['integer', 'min:0', 'max:90'])
                ->label('Reserve (%)')
                ->help('The share of the total memory and storage of all nodes that must stay unallocated, so the machines are never pushed to their limit.')
                ->tab('Resources')
                ->field('number'),
        ]);
        $this->registerSettings($definition);
        // Every icon element the panel would render is replaced, so no Pterodactyl icon is left in the page head
        // (upstream skips its own default for each element an extension registers).
        $this->registerHeadTags(function () use ($definition): array {
            $favicon = $this->assetUrl($definition, 'favicon', self::DEFAULT_FAVICON);

            return [
                ['tag' => 'link', 'rel' => 'icon', 'type' => 'image/png', 'sizes' => '32x32', 'href' => $favicon],
                ['tag' => 'link', 'rel' => 'shortcut icon', 'href' => $favicon === self::DEFAULT_FAVICON ? self::DEFAULT_FAVICON_ICO : $favicon],
                ['tag' => 'link', 'rel' => 'apple-touch-icon', 'sizes' => '180x180', 'href' => $this->assetUrl($definition, 'logo', self::DEFAULT_LOGO)],
                ['tag' => 'link', 'rel' => 'manifest', 'href' => '/gobia/manifest.json'],
                ['tag' => 'link', 'rel' => 'mask-icon', 'href' => '/gobia/img/mask-icon.svg', 'color' => '#1264d1'],
                ['tag' => 'meta', 'name' => 'msapplication-config', 'content' => '/gobia/browserconfig.xml'],
            ];
        });
    }

    /** A file setting reads as the public URL of its upload, or the default while nothing is uploaded. */
    private function assetUrl(ExtensionSettingsDefinition $definition, string $key, string $default): string
    {
        $value = $definition->get($key);

        return is_string($value) && $value !== '' ? $value : $default;
    }
}
