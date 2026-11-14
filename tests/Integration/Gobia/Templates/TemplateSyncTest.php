<?php

declare(strict_types=1);

namespace Pterodactyl\Tests\Integration\Gobia\Templates;

use GobiaTemplates\Jobs\SyncTemplateJob;
use GobiaTemplates\Models\ServerTemplate;
use GobiaTemplates\Models\TemplateInstance;
use GobiaTemplates\Services\TemplateService;
use GobiaTemplates\Services\TemplateSyncService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Pterodactyl\Models\User;
use Pterodactyl\Tests\Integration\Gobia\BuildsTemplates;
use Pterodactyl\Tests\Integration\IntegrationTestCase;
use Ramsey\Uuid\Uuid;

/** Servers that follow a template receive each new revision of the synced paths, one at a time, with a rollback. */
class TemplateSyncTest extends IntegrationTestCase
{
    use BuildsTemplates;

    private const ADMIN = '/api/admin/extensions/gobia-templates';

    /** @var list<array{method: string, path: string, query: string, body: string}> */
    private array $calls = [];

    /** What the node reports for a server after a restart. */
    private string $stateAfterRestart = 'running';

    /** What the node reports after the second restart (the one after a rollback). */
    private string $stateAfterSecondRestart = 'offline';

    /** @var array<string, int> server uuid => restarts */
    private array $restarted = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->bootTemplates();
        Queue::fake();
        config(['gobia_templates.sync.poll_seconds' => 0, 'gobia_templates.sync.health_timeout' => 0]);
        Http::fake(function (Request $request) {
            $path = (string) parse_url($request->url(), PHP_URL_PATH);
            $this->calls[] = ['method' => $request->method(), 'path' => $path, 'query' => urldecode((string) parse_url($request->url(), PHP_URL_QUERY)), 'body' => $request->body()];
            if ($request->method() === 'GET' && preg_match('#^/api/servers/([0-9a-f-]{36})$#', $path, $m)) {
                $state = match ($this->restarted[$m[1]] ?? 0) {
                    0 => 'running',
                    1 => $this->stateAfterRestart,
                    default => $this->stateAfterSecondRestart,
                };

                return Http::response(['state' => $state, 'is_suspended' => false]);
            }
            if (preg_match('#^/api/servers/([0-9a-f-]{36})/power$#', $path, $m)) {
                $this->restarted[$m[1]] = ($this->restarted[$m[1]] ?? 0) + 1;
            }

            return Http::response('', 204);
        });
    }

    protected function tearDown(): void
    {
        $this->shutdownTemplates();
        parent::tearDown();
    }

    public function test_the_diff_only_covers_synced_paths(): void
    {
        $from = [['path' => 'plugins/a.yml', 'size' => 1, 'sha256' => 'a'], ['path' => 'plugins/old.jar', 'size' => 1, 'sha256' => 'o'], ['path' => 'world/level.dat', 'size' => 1, 'sha256' => 'w']];
        $to = [['path' => 'plugins/a.yml', 'size' => 1, 'sha256' => 'b'], ['path' => 'plugins/new.yml', 'size' => 1, 'sha256' => 'n'], ['path' => 'world/level.dat', 'size' => 1, 'sha256' => 'x'], ['path' => 'pluginsextra/z', 'size' => 1, 'sha256' => 'z']];

        $diff = TemplateSyncService::diff($from, $to, ['plugins']);

        $this->assertSame(['plugins/a.yml', 'plugins/new.yml'], array_column($diff['put'], 'path'));
        $this->assertSame(['plugins/old.jar'], $diff['delete']);
    }

    public function test_a_new_revision_reaches_following_servers_and_restarts_them(): void
    {
        [$template, $first] = $this->templateWithRevision();
        $follower = $this->follower($template, $first);
        $bystander = $this->follower($template, $first, follow: false);
        $second = $this->secondRevision($template);

        $result = app(TemplateSyncService::class)->rollout($template->refresh());

        $this->assertSame(['synced' => 1, 'skipped' => 0, 'failed' => null], $result);
        $uuid = $follower->server->uuid;
        $writes = $this->calls(fn (array $call): bool => str_ends_with($call['path'], "{$uuid}/files/write"));
        $this->assertSame(['file=/plugins/a.yml', 'file=/plugins/new.yml'], array_column($writes, 'query'));
        $this->assertSame("a: 2\n", $writes[0]['body']);
        $deletes = $this->calls(fn (array $call): bool => str_ends_with($call['path'], "{$uuid}/files/delete"));
        $this->assertSame(['root' => '/', 'files' => ['plugins/old.jar']], json_decode($deletes[0]['body'], true));
        $this->assertCount(1, $this->calls(fn (array $call): bool => str_ends_with($call['path'], "{$uuid}/power")));
        $this->assertSame([], $this->calls(fn (array $call): bool => str_contains($call['query'], 'world')));
        $this->assertSame([], $this->calls(fn (array $call): bool => str_contains($call['path'], $bystander->server->uuid.'/files')));

        $follower->refresh();
        $this->assertSame($second, $follower->synced_revision);
        $this->assertSame(TemplateSyncService::SYNCED, $follower->sync_state);

        // Nothing left to do: a second rollout skips it.
        $this->assertSame(['synced' => 0, 'skipped' => 1, 'failed' => null], app(TemplateSyncService::class)->rollout($template->refresh()));
    }

    public function test_a_server_that_does_not_come_back_is_rolled_back_and_the_rollout_stops(): void
    {
        [$template, $first] = $this->templateWithRevision();
        $broken = $this->follower($template, $first);
        $next = $this->follower($template, $first);
        $this->secondRevision($template);
        $this->stateAfterRestart = 'offline';

        $result = app(TemplateSyncService::class)->rollout($template->refresh());

        $this->assertSame($broken->name, $result['failed']);
        $uuid = $broken->server->uuid;
        $writes = $this->calls(fn (array $call): bool => str_ends_with($call['path'], "{$uuid}/files/write"));
        // Forward (a.yml, new.yml), then back to the previous revision (a.yml, old.jar), and new.yml removed again.
        $this->assertSame(['file=/plugins/a.yml', 'file=/plugins/new.yml', 'file=/plugins/a.yml', 'file=/plugins/old.jar'], array_column($writes, 'query'));
        $this->assertSame("a: 1\n", $writes[2]['body']);
        $deletes = $this->calls(fn (array $call): bool => str_ends_with($call['path'], "{$uuid}/files/delete"));
        $this->assertSame(['plugins/new.yml'], json_decode($deletes[1]['body'], true)['files']);

        $broken->refresh();
        $this->assertSame(TemplateSyncService::FAILED, $broken->sync_state);
        $this->assertNull($broken->synced_revision);
        $this->assertSame([], $this->calls(fn (array $call): bool => str_contains($call['path'], $next->server->uuid.'/files')));
        $this->assertNull($next->refresh()->sync_state);
    }

    public function test_the_rollback_restores_the_server_when_it_comes_back_after_the_restore(): void
    {
        [$template, $first] = $this->templateWithRevision();
        $instance = $this->follower($template, $first);
        $this->secondRevision($template);
        // The first restart fails the health check; after the restore the server runs again.
        $this->stateAfterRestart = 'starting';
        $this->stateAfterSecondRestart = 'running';

        app(TemplateSyncService::class)->rollout($template->refresh());

        $this->assertSame(TemplateSyncService::ROLLED_BACK, $instance->refresh()->sync_state);
        $this->assertStringContainsString('previous files were restored', (string) $instance->sync_error);
    }

    public function test_publishing_queues_a_rollout_and_the_admin_api_manages_following(): void
    {
        [$template, $first] = $this->templateWithRevision();
        $instance = $this->follower($template, $first, follow: false);
        $this->actingAs(User::factory()->create(['root_admin' => true]));

        $this->postJson(self::ADMIN."/templates/{$template->id}/instances/{$instance->uuid}/follow", ['follow' => true])->assertOk()->assertJsonPath('follow', true);
        $this->assertTrue($instance->refresh()->follow);

        app(TemplateService::class)->putFile($template, 'plugins/a.yml', "a: 3\n");
        $this->postJson(self::ADMIN."/templates/{$template->id}/publish")->assertOk()->assertJsonPath('created_revision', true);
        Queue::assertPushed(SyncTemplateJob::class, 1);

        $this->postJson(self::ADMIN."/templates/{$template->id}/sync")->assertStatus(202);
        Queue::assertPushed(SyncTemplateJob::class, 2);

        $input = $this->templateInput(['name' => $template->name, 'slug' => $template->slug]);
        $this->patchJson(self::ADMIN."/templates/{$template->id}", $input + ['sync_paths' => ['../etc']])->assertUnprocessable()->assertJsonPath('errors.0.meta.source_field', 'sync_paths.0');
        $this->patchJson(self::ADMIN."/templates/{$template->id}", $input + ['sync_paths' => ['/plugins/', 'config']])->assertOk();
        $this->assertSame(['plugins', 'config'], $template->refresh()->sync_paths);

        $other = $this->makeTemplate(['name' => 'Other sync template']);
        $this->postJson(self::ADMIN."/templates/{$other->id}/instances/{$instance->uuid}/follow", ['follow' => false])->assertNotFound();
    }

    /** @return array{0: ServerTemplate, 1: int} */
    private function templateWithRevision(): array
    {
        $service = app(TemplateService::class);
        $template = $this->makeTemplate(['name' => 'Hub '.bin2hex(random_bytes(3))]);
        $template->forceFill(['sync_paths' => ['plugins']])->save();
        $service->putFile($template, 'plugins/a.yml', "a: 1\n");
        $service->putFile($template, 'plugins/old.jar', 'old');
        $service->putFile($template, 'world/level.dat', 'w1');
        $service->publish($template);

        return [$template->refresh(), $template->revision];
    }

    private function secondRevision(ServerTemplate $template): int
    {
        $service = app(TemplateService::class);
        $service->putFile($template, 'plugins/a.yml', "a: 2\n");
        $service->putFile($template, 'plugins/new.yml', 'n');
        $service->deleteFile($template, 'plugins/old.jar');
        $service->putFile($template, 'world/level.dat', 'w2');
        $service->publish($template);

        return $template->refresh()->revision;
    }

    private function follower(ServerTemplate $template, int $revision, bool $follow = true): TemplateInstance
    {
        $server = $this->createServerModel();

        return TemplateInstance::query()->forceCreate([
            'uuid' => Uuid::uuid4()->toString(),
            'template_id' => $template->id,
            'template_revision' => $revision,
            'server_id' => $server->id,
            'owner_id' => $server->owner_id,
            'name' => $server->name,
            'state' => TemplateInstance::STATE_READY,
            'follow' => $follow,
        ])->load('server');
    }

    /** @return list<array{method: string, path: string, query: string, body: string}> */
    private function calls(callable $filter): array
    {
        return array_values(array_filter($this->calls, $filter));
    }
}
