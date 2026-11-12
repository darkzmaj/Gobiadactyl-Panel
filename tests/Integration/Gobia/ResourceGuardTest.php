<?php

declare(strict_types=1);

use GobiaCore\Services\ResourceGuard;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Pterodactyl\Contracts\Servers\CreatesServers;
use Pterodactyl\Contracts\Servers\UpdatesServerBuild;
use Pterodactyl\Models\User;
use Pterodactyl\Services\Extensions\ExtensionRepository;
use Pterodactyl\Tests\Integration\Api\Client\ClientApiIntegrationTestCase;
use Pterodactyl\Tests\Integration\Gobia\InstallsGobiaExtensions;

uses(ClientApiIntegrationTestCase::class, InstallsGobiaExtensions::class);

beforeEach(function (): void {
    // A build change tells Wings; nothing here should reach a real daemon.
    Http::fake();
    $this->installGobia(['gobia-core']);
});
afterEach(fn () => $this->uninstallGobia());

function guardSettings(array $values): void
{
    app(ExtensionRepository::class)->settings('gobia-core')->setMany($values);
}

test('the protector is off by default and only advises', function (): void {
    $guard = app(ResourceGuard::class);

    expect($guard->enabled())->toBeFalse();
    expect($guard->summary()['reserve_percent'])->toBe(ResourceGuard::DEFAULT_RESERVE);
    // Off: nothing is refused, however large.
    $guard->assertFits(PHP_INT_MAX, PHP_INT_MAX);
});

test('switched on, an allocation that would eat into the reserve is refused and one that fits is not', function (): void {
    $server = $this->createServerModel(['owner_id' => User::factory()->create()->id, 'memory' => 1024, 'disk' => 1024]);
    $server->node->forceFill(['memory' => 100_000, 'disk' => 100_000])->save();
    guardSettings([ResourceGuard::ENABLED => true, ResourceGuard::RESERVE => 20]);
    $guard = app(ResourceGuard::class);

    $summary = $guard->summary();
    expect($summary['enabled'])->toBeTrue();
    expect($summary['memory']['reserved'])->toBe((int) ceil($summary['memory']['total'] * 0.2));
    expect($summary['memory']['safe'])->toBe(max(0, $summary['memory']['total'] - $summary['memory']['reserved'] - $summary['memory']['allocated']));

    $guard->assertFits($summary['memory']['safe'], 0);
    expect(fn () => $guard->assertFits($summary['memory']['safe'] + 1, 0))->toThrow(ValidationException::class);

    // It sits in front of the core actions, whoever calls them.
    $grow = $server->memory + $summary['memory']['safe'] + 1;
    try {
        app(UpdatesServerBuild::class)->update($server, ['memory' => $grow]);
        $this->fail('Growing past the reserve was allowed.');
    } catch (ValidationException $exception) {
        expect($exception->errors())->toHaveKey('memory');
    }

    try {
        app(CreatesServers::class)->create(['memory' => 0, 'disk' => $summary['disk']['safe'] + 1]);
        $this->fail('Creating past the reserve was allowed.');
    } catch (ValidationException $exception) {
        expect($exception->errors())->toHaveKey('disk');
    }

    // Shrinking is always allowed, and an out of range reserve is clamped.
    expect(app(UpdatesServerBuild::class)->update($server, ['memory' => 512])->memory)->toBe(512);
    guardSettings([ResourceGuard::RESERVE => 500]);
    expect(app(ResourceGuard::class)->reserve())->toBe(90);
});
