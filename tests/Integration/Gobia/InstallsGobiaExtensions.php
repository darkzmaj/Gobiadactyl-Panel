<?php

declare(strict_types=1);

namespace Pterodactyl\Tests\Integration\Gobia;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;
use Pterodactyl\Contracts\Extensions\InstallsExtensions;
use Pterodactyl\Models\Extension;
use Pterodactyl\Models\ExtensionSetting;
use Pterodactyl\Services\Extensions\ExtensionProviderLoader;
use Pterodactyl\Services\Extensions\ExtensionRepository;

/**
 * Installs the real Gobia extensions from extensions/ into a temporary extensions directory with a stub frontend
 * bundle, then boots their providers, so backend behaviour is tested against the same code that ships.
 */
trait InstallsGobiaExtensions
{
    private string $gobiaDirectory = '';

    /** @var list<string> */
    private array $gobiaInstalled = [];

    /** @param list<string> $ids */
    protected function installGobia(array $ids): void
    {
        $this->gobiaDirectory = sys_get_temp_dir().'/gobia-ext-'.uniqid();
        File::ensureDirectoryExists($this->gobiaDirectory.'/installed');
        // Published bundles go to a temporary directory too, so tests never overwrite a developer's real public/assets/extensions.
        File::ensureDirectoryExists($this->gobiaDirectory.'/assets');
        config(['extensions.enabled' => true, 'extensions.directory' => $this->gobiaDirectory.'/installed', 'extensions.assets_directory' => $this->gobiaDirectory.'/assets']);
        $this->app->make(ExtensionRepository::class)->flushDiscovery();

        foreach ($ids as $id) {
            $source = $this->gobiaDirectory.'/source-'.$id;
            File::copyDirectory(base_path('extensions/'.$id), $source);
            File::deleteDirectory($source.'/node_modules');
            File::ensureDirectoryExists($source.'/dist');
            file_put_contents($source.'/dist/client.js', 'export default {};');
            $this->app->make(InstallsExtensions::class)->install($source, enable: true);
            $this->gobiaInstalled[] = $id;
        }

        Route::getRoutes()->refreshNameLookups();
        $this->app->make(ExtensionProviderLoader::class)->registerProviders($this->app->make(ExtensionRepository::class)->enabled());
        $this->reopenTestTransaction();
    }

    protected function uninstallGobia(): void
    {
        // The DROP TABLE statements below commit whatever the test wrote, so its transaction is rolled back first.
        $this->rollBackTestTransaction();

        foreach ($this->gobiaInstalled as $id) {
            Extension::query()->where('identifier', $id)->delete();
            ExtensionSetting::query()->where('extension', $id)->delete();
        }
        $this->gobiaInstalled = [];
        // The extensions own their tables; drop them so the next test starts clean.
        foreach (DB::select('SHOW TABLES LIKE "gobia\\_%"') as $row) {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
            DB::statement('DROP TABLE IF EXISTS `'.array_values((array) $row)[0].'`');
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }
        DB::table('migrations')->where('migration', 'like', '%gobia%')->delete();
        File::deleteDirectory($this->gobiaDirectory);
        $this->reopenTestTransaction();
    }

    /** Discards what the test wrote so far; call it before DDL that would otherwise commit those rows. */
    protected function rollBackTestTransaction(): void
    {
        $pdo = DB::connection()->getPdo();
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
    }

    /**
     * MySQL commits the open transaction on DDL (the extension migrations, DROP TABLE). DatabaseTransactions keeps
     * counting its transaction regardless, so a real one is opened again: without it a savepoint the code under test
     * rolls back to does not exist, and every write afterwards would outlive the test.
     */
    protected function reopenTestTransaction(): void
    {
        $pdo = DB::connection()->getPdo();
        if (DB::transactionLevel() > 0 && ! $pdo->inTransaction()) {
            $pdo->beginTransaction();
        }
    }
}
