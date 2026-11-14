<?php

declare(strict_types=1);

namespace Pterodactyl\Tests\Pest\Integration\Gobia\TimeZoneTest;

use Carbon\CarbonImmutable;
use Pterodactyl\Models\Schedule;
use Pterodactyl\Models\User;
use Pterodactyl\Services\Extensions\ExtensionRepository;
use Pterodactyl\Tests\Integration\Api\Client\ClientApiIntegrationTestCase;
use Pterodactyl\Tests\Integration\Gobia\InstallsGobiaExtensions;

uses(ClientApiIntegrationTestCase::class, InstallsGobiaExtensions::class);

beforeEach(fn () => $this->installGobia(['gobia-core']));
afterEach(function (): void {
    CarbonImmutable::setTestNow();
    $this->uninstallGobia();
});

function daily(string $hour): Schedule
{
    return new Schedule(['cron_minute' => '0', 'cron_hour' => $hour, 'cron_day_of_month' => '*', 'cron_month' => '*', 'cron_day_of_week' => '*']);
}

test('without a panel time zone, schedules keep using the application time zone', function (): void {
    config(['app.timezone' => 'UTC', 'app.display_timezone' => null]);
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-07-01 01:00:00', 'UTC'));

    expect(daily('4')->getNextRunDate()->toIso8601String())->toBe('2026-07-01T04:00:00+00:00');
});

test('with a panel time zone, a schedule fires at that local time on both sides of daylight saving time', function (): void {
    config(['app.timezone' => 'UTC', 'app.display_timezone' => 'Europe/Ljubljana']);

    // Summer (CEST, UTC+2): 04:00 local is 02:00 UTC.
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-07-01 00:30:00', 'UTC'));
    expect(daily('4')->getNextRunDate()->toIso8601String())->toBe('2026-07-01T02:00:00+00:00');

    // Winter (CET, UTC+1): 04:00 local is 03:00 UTC.
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-01-15 00:30:00', 'UTC'));
    expect(daily('4')->getNextRunDate()->toIso8601String())->toBe('2026-01-15T03:00:00+00:00');

    // Across the change (last Sunday of October 2026): the day after still runs at 04:00 local.
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-25 03:30:00', 'UTC'));
    expect(daily('4')->getNextRunDate()->toIso8601String())->toBe('2026-10-26T03:00:00+00:00');

    // Stored in the application time zone, like every other timestamp.
    expect(daily('4')->getNextRunDate()->getTimezone()->getName())->toBe('UTC');
});

test('administrators choose the time zone from the list; anything else is refused', function (): void {
    $url = '/api/admin/extensions/gobia-core/settings';
    $this->actingAs(User::factory()->create(['root_admin' => true]));

    $this->patchJson($url, ['settings' => ['timezone' => 'Mars/Olympus']])->assertUnprocessable();
    $this->patchJson($url, ['settings' => ['timezone' => 'Europe/Ljubljana']])->assertOk();

    expect(app(ExtensionRepository::class)->settings('gobia-core')->get('timezone'))->toBe('Europe/Ljubljana');
});
