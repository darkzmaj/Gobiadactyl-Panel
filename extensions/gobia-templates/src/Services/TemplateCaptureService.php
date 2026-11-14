<?php

declare(strict_types=1);

namespace GobiaTemplates\Services;

use GobiaTemplates\Models\ServerTemplate;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Http;
use Psr\Http\Message\ResponseInterface;
use Pterodactyl\Exceptions\DisplayException;
use Pterodactyl\Facades\Daemon;
use Pterodactyl\Models\Server;
use RuntimeException;
use Throwable;

/**
 * Creates a template from a live server: its software, image, startup, resources and variable values, and a copy of its
 * files in the new template's working tree. Nothing is published; an administrator reviews the copy and publishes it.
 *
 * Files are streamed from Wings through a temporary file into the template store, so memory does not depend on file
 * size. Symbolic links are skipped, and the store's own path rules (reserved names such as .env) and limits apply.
 */
class TemplateCaptureService
{
    public const int MAX_DEPTH = 24;

    public function __construct(private readonly TemplateService $templates, private readonly TemplateFileStore $files) {}

    /**
     * @param  list<string>  $exclude  paths relative to the server root that are not copied (worlds, logs, caches)
     * @return array{template: ServerTemplate, files: int, bytes: int, skipped: list<string>}
     *
     * @throws Throwable
     */
    public function capture(Server $server, string $name, array $exclude = []): array
    {
        if ($server->node->isUnderMaintenance()) {
            throw new DisplayException('The node of this server is under maintenance.');
        }

        $template = $this->templates->create($this->settings($server, $name));
        $result = ['files' => 0, 'bytes' => 0, 'skipped' => []];
        $exclude = array_map(fn (string $path): string => mb_trim($path, '/'), $exclude);
        try {
            $this->walk($server, $template, '', 0, $exclude, $result);
        } catch (Throwable $exception) {
            // The server's files could not be listed: no half copied template is left behind.
            rescue(fn () => $this->templates->delete($template), report: false);

            throw $exception;
        }

        return ['template' => $template->refresh()] + $result;
    }

    /** @return array<string, mixed> */
    private function settings(Server $server, string $name): array
    {
        $variables = [];
        foreach ($server->variables as $variable) {
            $variables[$variable->env_variable] = ['value' => $variable->server_value ?? $variable->default_value, 'overridable' => (bool) $variable->user_editable];
        }

        // A server can run an image its software no longer lists; the template then starts from the software's first image.
        $images = array_values($server->egg->docker_images ?? []);
        $image = in_array($server->image, $images, true) ? $server->image : ($images[0] ?? $server->image);

        return [
            'name' => $name,
            'description' => 'Created from the server '.$server->name.'.',
            'enabled' => false,
            'egg_id' => $server->egg_id,
            'docker_image' => $image,
            'startup' => $server->startup,
            'memory' => $server->memory,
            'swap' => $server->swap,
            'disk' => $server->disk,
            'cpu' => $server->cpu,
            'io' => $server->io,
            'oom_disabled' => (bool) $server->oom_disabled,
            'database_limit' => $server->database_limit,
            'allocation_limit' => $server->allocation_limit,
            'backup_limit' => $server->backup_limit,
            'placement_mode' => ServerTemplate::PLACEMENT_FIXED,
            'node_id' => $server->node_id,
            'variables' => $variables,
        ];
    }

    /**
     * @param  list<string>  $exclude
     * @param  array{files: int, bytes: int, skipped: list<string>}  $result
     */
    private function walk(Server $server, ServerTemplate $template, string $directory, int $depth, array $exclude, array &$result): void
    {
        if ($depth > self::MAX_DEPTH) {
            $result['skipped'][] = $directory.' (nested too deeply)';

            return;
        }

        foreach (Daemon::server($server)->files()->getDirectory('/'.$directory) as $entry) {
            $path = mb_ltrim($directory.'/'.($entry['name'] ?? ''), '/');
            if (in_array($path, $exclude, true)) {
                continue;
            }
            if (($entry['symlink'] ?? false) === true) {
                $result['skipped'][] = $path.' (symbolic link)';

                continue;
            }
            if (! ($entry['file'] ?? false)) {
                $this->walk($server, $template, $path, $depth + 1, $exclude, $result);

                continue;
            }

            if ($this->files->isSecretFile($path)) {
                $result['skipped'][] = $path.' (may hold a secret)';

                continue;
            }
            try {
                $this->files->normalizePath($path);
            } catch (DisplayException) {
                $result['skipped'][] = $path.' (not allowed in a template)';

                continue;
            }

            $temporary = (string) tempnam(sys_get_temp_dir(), 'gobia-capture-');
            try {
                $this->download($server, $path, $temporary);
                $handle = Utils::tryFopen($temporary, 'rb');
                try {
                    $result['bytes'] += $this->templates->uploadFile($template, $path, $handle, (int) filesize($temporary));
                } finally {
                    fclose($handle);
                }
                $result['files']++;
            } catch (Throwable $exception) {
                // One file that cannot be copied (too large, over the template limits, unreadable) does not stop the rest.
                $result['skipped'][] = $path.' ('.($exception instanceof DisplayException ? $exception->getMessage() : 'could not be read').')';
            } finally {
                @unlink($temporary);
            }
        }
    }

    private function download(Server $server, string $path, string $sink): void
    {
        $node = $server->node;
        $limit = $this->files->limits()['max_file_bytes'];
        $guard = function (ResponseInterface $response) use ($limit): void {
            if ((int) $response->getHeaderLine('Content-Length') > $limit) {
                throw new RuntimeException('The file is larger than a template file may be.');
            }
        };

        Http::baseUrl($node->getConnectionAddress())
            ->withToken($node->getDecryptedKey())
            ->connectTimeout((int) config('pterodactyl.guzzle.connect_timeout', 5))
            ->timeout(3600)
            ->withOptions(['verify' => App::isProduction(), 'sink' => $sink, 'on_headers' => $guard])
            ->get("/api/servers/{$server->uuid}/files/contents?".http_build_query(['file' => '/'.$path]))
            ->throw();
    }
}
