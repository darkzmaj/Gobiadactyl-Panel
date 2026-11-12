<?php

declare(strict_types=1);

namespace GobiaCore\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Pterodactyl\Services\Extensions\ExtensionRepository;

/**
 * The resource protector: keeps a share of the memory and storage of all nodes together unallocated, so the machines are
 * never planned up to their limit. Off by default (Admin, Extensions, Gobia Core, Resources); while off, the overview
 * still shows what is safe to allocate with the configured reserve, it just does not refuse anything.
 *
 * Sizes are megabytes, as nodes and servers store them. An unlimited server (0) allocates nothing, as in core.
 */
class ResourceGuard
{
    public const string ENABLED = 'resource_guard_enabled';

    public const string RESERVE = 'resource_guard_reserve';

    public const int DEFAULT_RESERVE = 10;

    public function __construct(private readonly ExtensionRepository $extensions) {}

    public function enabled(): bool
    {
        return (bool) $this->setting(self::ENABLED, false);
    }

    /** The reserve in percent, clamped to 0 to 90 whatever is stored. */
    public function reserve(): int
    {
        return max(0, min(90, (int) $this->setting(self::RESERVE, self::DEFAULT_RESERVE)));
    }

    /**
     * Totals across all nodes: capacity, what servers have allocated, the share kept back and what can still be
     * allocated without touching it (never negative).
     *
     * @return array{enabled: bool, reserve_percent: int, memory: array{total: int, allocated: int, reserved: int, safe: int}, disk: array{total: int, allocated: int, reserved: int, safe: int}}
     */
    public function summary(): array
    {
        $capacity = DB::table('nodes')->selectRaw('COALESCE(SUM(memory), 0) AS memory, COALESCE(SUM(disk), 0) AS disk')->first();
        $allocated = DB::table('servers')->selectRaw('COALESCE(SUM(memory), 0) AS memory, COALESCE(SUM(disk), 0) AS disk')->first();
        $reserve = $this->reserve();
        $part = function (string $column) use ($capacity, $allocated, $reserve): array {
            $total = (int) ($capacity->{$column} ?? 0);
            $used = (int) ($allocated->{$column} ?? 0);
            $reserved = (int) ceil($total * $reserve / 100);

            return ['total' => $total, 'allocated' => $used, 'reserved' => $reserved, 'safe' => max(0, $total - $reserved - $used)];
        };

        return ['enabled' => $this->enabled(), 'reserve_percent' => $reserve, 'memory' => $part('memory'), 'disk' => $part('disk')];
    }

    /**
     * Refuses an allocation that would leave less than the reserve free across all nodes. `$memory` and `$disk` are the
     * megabytes being added (a new server's limits, or how much an existing one grows); shrinking is always allowed.
     *
     * @throws ValidationException naming the field that does not fit
     */
    public function assertFits(int $memory, int $disk): void
    {
        if (! $this->enabled() || ($memory <= 0 && $disk <= 0)) {
            return;
        }

        $summary = $this->summary();
        $errors = [];
        foreach (['memory' => $memory, 'disk' => $disk] as $field => $adding) {
            if ($adding > 0 && $adding > $summary[$field]['safe']) {
                $errors[$field] = sprintf(
                    'The resource protector keeps %d%% of all nodes\' %s free: only %d MiB can still be allocated, this needs %d MiB.',
                    $summary['reserve_percent'],
                    $field === 'memory' ? 'memory' : 'storage',
                    $summary[$field]['safe'],
                    $adding,
                );
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function setting(string $key, mixed $default): mixed
    {
        return rescue(fn (): mixed => $this->extensions->settings('gobia-core')->get($key, $default), $default, report: false);
    }
}
