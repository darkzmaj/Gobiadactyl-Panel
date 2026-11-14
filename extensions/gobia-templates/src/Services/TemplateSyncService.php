<?php

declare(strict_types=1);

namespace GobiaTemplates\Services;

use GobiaTemplates\Models\ServerTemplate;
use GobiaTemplates\Models\TemplateInstance;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Exceptions\DisplayException;
use Pterodactyl\Facades\Daemon;
use Pterodactyl\Models\Server;
use Throwable;

/**
 * Keeps servers that follow a template in step with it. The template is the source of truth; servers never sync with
 * each other. Only files under the template's synced paths are touched (never worlds or anything else), and only the
 * difference between the revision a server has and the new one: changed and new files are written, files the new
 * revision no longer has are removed.
 *
 * A rollout goes one server at a time. A server that was running is restarted and must come back running; if writing,
 * restarting or the health check fails, that server gets the files of its previous revision back, is restarted again,
 * and the rollout stops so the remaining servers stay as they were.
 */
class TemplateSyncService
{
    public const string SYNCING = 'syncing';

    public const string SYNCED = 'synced';

    public const string ROLLED_BACK = 'rolled_back';

    public const string FAILED = 'failed';

    public function __construct(
        private readonly TemplateService $templates,
        private readonly TemplateFileStore $files,
        private readonly DaemonUploader $uploader,
    ) {}

    /**
     * The files to write and the paths to remove to go from one file list to another, limited to the synced paths.
     *
     * @param  list<array{path: string, size: int, sha256: string}>  $from
     * @param  list<array{path: string, size: int, sha256: string}>  $to
     * @param  list<string>  $paths
     * @return array{put: list<array{path: string, size: int, sha256: string}>, delete: list<string>}
     */
    public static function diff(array $from, array $to, array $paths): array
    {
        $inside = function (string $file) use ($paths): bool {
            foreach ($paths as $path) {
                if ($file === $path || str_starts_with($file, $path.'/')) {
                    return true;
                }
            }

            return false;
        };
        $before = [];
        foreach ($from as $file) {
            if ($inside($file['path'])) {
                $before[$file['path']] = $file['sha256'];
            }
        }

        $put = [];
        $keep = [];
        foreach ($to as $file) {
            if (! $inside($file['path'])) {
                continue;
            }
            $keep[$file['path']] = true;
            if (($before[$file['path']] ?? null) !== $file['sha256']) {
                $put[] = $file;
            }
        }
        $delete = array_values(array_filter(array_keys($before), fn (string $path): bool => ! isset($keep[$path])));
        sort($delete);

        return ['put' => $put, 'delete' => $delete];
    }

    /**
     * Rolls the template's current revision out to every following server, one at a time.
     *
     * @return array{synced: int, skipped: int, failed: ?string}
     */
    public function rollout(ServerTemplate $template): array
    {
        $result = ['synced' => 0, 'skipped' => 0, 'failed' => null];
        $paths = array_values(array_map(fn (mixed $path): string => is_string($path) ? $path : '', (array) ($template->sync_paths ?? [])));
        if ($paths === []) {
            return $result;
        }
        $target = $template->revision;

        $followers = $template->instances()
            ->where('follow', true)
            ->where('state', TemplateInstance::STATE_READY)
            ->whereNotNull('server_id')
            ->orderBy('id')
            ->get();

        foreach ($followers as $instance) {
            $current = $instance->synced_revision ?? $instance->template_revision;
            if ($current === $target) {
                $result['skipped']++;

                continue;
            }
            if (! $this->syncOne($template, $instance, $current, $target, $paths)) {
                $result['failed'] = $instance->name;

                break;
            }
            $result['synced']++;
        }

        return $result;
    }

    /** @param list<string> $paths */
    private function syncOne(ServerTemplate $template, TemplateInstance $instance, int $current, int $target, array $paths): bool
    {
        $server = Server::query()->find($instance->server_id);
        if ($server === null) {
            return true;
        }
        $before = $this->filesOf($template, $current);
        $after = $this->filesOf($template, $target);
        $forward = self::diff($before, $after, $paths);
        $instance->forceFill(['sync_state' => self::SYNCING, 'sync_error' => null])->save();

        $running = $this->state($server) === 'running';
        try {
            $this->apply($template, $server, $forward);
            $this->restartAndCheck($server, $running);
        } catch (Throwable $exception) {
            $reason = $exception instanceof DisplayException ? $exception->getMessage() : 'The node did not accept the change.';
            Log::warning('Template sync failed; restoring the previous revision.', ['instance' => $instance->uuid, 'exception' => $exception]);
            try {
                $this->apply($template, $server, self::diff($after, $before, $paths));
                $this->restartAndCheck($server, $running);
                $instance->forceFill(['sync_state' => self::ROLLED_BACK, 'sync_error' => mb_substr($reason.' The previous files were restored.', 0, 500)])->save();
            } catch (Throwable $rollback) {
                Log::error('Template sync rollback failed.', ['instance' => $instance->uuid, 'exception' => $rollback]);
                $instance->forceFill(['sync_state' => self::FAILED, 'sync_error' => mb_substr($reason.' Restoring the previous files failed too; check the server.', 0, 500)])->save();
            }

            return false;
        }

        $instance->forceFill(['synced_revision' => $target, 'sync_state' => self::SYNCED, 'sync_error' => null, 'synced_at' => now()])->save();

        return true;
    }

    /** @return list<array{path: string, size: int, sha256: string}> */
    private function filesOf(ServerTemplate $template, int $revision): array
    {
        $row = $this->templates->revision($template, $revision);
        if ($row === null) {
            throw new DisplayException("Revision {$revision} of this template no longer exists.");
        }

        /** @var list<array{path: string, size: int, sha256: string}> $files */
        $files = $row->snapshot['files'] ?? [];

        return $files;
    }

    /** @param array{put: list<array{path: string, size: int, sha256: string}>, delete: list<string>} $change */
    private function apply(ServerTemplate $template, Server $server, array $change): void
    {
        $daemon = Daemon::server($server);
        foreach ($change['put'] as $file) {
            // Wings creates missing parent folders when it writes a file.
            $path = '/'.$this->files->normalizePath($file['path']);
            if ($file['size'] <= TemplateProvisioningService::INLINE_BYTES) {
                $daemon->files()->putContent($path, $this->files->read($template, $file['sha256']));

                continue;
            }
            $stream = Utils::tryFopen($this->files->blobPath($template, $file['sha256']), 'rb');
            try {
                $this->uploader->stream($server, $path, $stream);
            } finally {
                fclose($stream);
            }
        }
        if ($change['delete'] !== []) {
            $daemon->files()->deleteFiles('/', array_map(fn (string $path): string => $this->files->normalizePath($path), $change['delete']));
        }
    }

    /** A server that was running is restarted and must report running again within the health timeout. */
    private function restartAndCheck(Server $server, bool $running): void
    {
        if (! $running) {
            // Still known to its node: nothing else to check for a stopped server.
            Daemon::server($server)->details();

            return;
        }

        Daemon::server($server)->power('restart');
        $deadline = microtime(true) + (int) config('gobia_templates.sync.health_timeout', 180);
        $poll = (int) config('gobia_templates.sync.poll_seconds', 3);
        do {
            if ($poll > 0) {
                sleep($poll);
            }
            if ($this->state($server) === 'running') {
                return;
            }
        } while (microtime(true) < $deadline);

        throw new DisplayException('The server did not come back running after the restart.');
    }

    private function state(Server $server): ?string
    {
        $state = Daemon::server($server)->details()['state'] ?? null;

        return is_string($state) ? $state : null;
    }
}
