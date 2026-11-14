<?php

declare(strict_types=1);

namespace Pterodactyl\Tests\Integration\Gobia\Templates;

use GobiaTemplates\Models\ServerTemplate;
use GobiaTemplates\Services\TemplateFileStore;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Pterodactyl\Models\User;
use Pterodactyl\Tests\Integration\Gobia\BuildsTemplates;
use Pterodactyl\Tests\Integration\IntegrationTestCase;

/** A template made from a live server: its settings and a copy of its files, through a fake Wings. */
class TemplateCaptureTest extends IntegrationTestCase
{
    use BuildsTemplates;

    private const URL = '/api/admin/extensions/gobia-templates/templates/from-server';

    /** @var array<string, string|null> path => content, null for a folder */
    private array $tree = [
        '/server.properties' => "motd=hub\n",
        '/plugins' => null,
        '/plugins/Gate.jar' => "\x00\x01binary\xff",
        '/world' => null,
        '/world/level.dat' => 'big world',
        '/.env' => 'SECRET=1',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->bootTemplates();
        Http::fake(function (Request $request) {
            parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);
            if (str_contains($request->url(), '/files/list-directory')) {
                $directory = mb_rtrim((string) ($query['directory'] ?? '/'), '/');
                $rows = [];
                foreach ($this->tree as $path => $content) {
                    $cut = (int) mb_strrpos($path, '/');
                    if (mb_substr($path, 0, $cut) === $directory) {
                        $rows[] = ['name' => mb_substr($path, $cut + 1), 'mode' => '', 'mode_bits' => '644', 'size' => mb_strlen((string) $content, '8bit'), 'file' => $content !== null, 'symlink' => false, 'mime' => 'text/plain', 'created' => '2026-01-01T00:00:00+00:00', 'modified' => '2026-01-01T00:00:00+00:00'];
                    }
                }

                return Http::response($rows);
            }
            if (str_contains($request->url(), '/files/contents')) {
                $content = $this->tree[(string) $query['file']] ?? null;

                return $content === null ? Http::response('', 404) : Http::response($content, 200, ['Content-Length' => (string) mb_strlen($content, '8bit')]);
            }

            return Http::response('', 204);
        });
    }

    protected function tearDown(): void
    {
        $this->shutdownTemplates();
        parent::tearDown();
    }

    public function test_an_administrator_creates_a_template_from_a_live_server(): void
    {
        $server = $this->createServerModel(['memory' => 1024, 'disk' => 2048]);
        $this->actingAs(User::factory()->create(['root_admin' => true]));
        $servers = $this->getJson('/api/admin/extensions/gobia-templates/options')->assertOk()->json('servers');
        $this->assertContains(['uuid' => $server->uuid, 'name' => $server->name], $servers);

        $response = $this->postJson(self::URL, ['server' => $server->uuid, 'name' => 'Hub capture', 'exclude' => ['world']])->assertCreated()->json();

        $template = ServerTemplate::query()->findOrFail($response['template']['template']['id'] ?? $response['template']['id']);
        $this->assertSame($server->egg_id, $template->egg_id);
        $this->assertSame(1024, $template->memory);
        $this->assertFalse((bool) $template->enabled);
        $this->assertSame(2, $response['files']);
        $this->assertSame(['.env (not allowed in a template)'], $response['skipped']);

        $work = app(TemplateFileStore::class)->workDirectory($template);
        $this->assertSame("\x00\x01binary\xff", file_get_contents($work.'/plugins/Gate.jar'));
        $this->assertSame("motd=hub\n", file_get_contents($work.'/server.properties'));
        $this->assertFileDoesNotExist($work.'/world/level.dat');
    }

    public function test_only_root_administrators_may_capture_a_server(): void
    {
        $server = $this->createServerModel();
        $this->actingAs($server->user);

        $this->postJson(self::URL, ['server' => $server->uuid, 'name' => 'Hub capture'])->assertForbidden();
        $this->assertFalse(ServerTemplate::query()->where('name', 'Hub capture')->exists());
    }
}
