<?php

declare(strict_types=1);

namespace GobiaCore\Actions;

use GobiaCore\Services\ResourceGuard;
use Pterodactyl\Contracts\Servers\CreatesServers;
use Pterodactyl\Models\Objects\DeploymentObject;
use Pterodactyl\Models\Server;

/**
 * Wraps core server creation (admin, application API, templates) with the resource protector. The core action still
 * validates its input; this only refuses a server whose memory or storage would eat into the reserve.
 */
final readonly class GuardedCreateServer implements CreatesServers
{
    public function __construct(private CreatesServers $inner, private ResourceGuard $guard) {}

    public function create(array $input, ?DeploymentObject $deployment = null): Server
    {
        $this->guard->assertFits(self::megabytes($input['memory'] ?? 0), self::megabytes($input['disk'] ?? 0));

        return $this->inner->create($input, $deployment);
    }

    /** A size as the API accepts it ("2048" or 2048); anything else is left to the core validation. */
    public static function megabytes(mixed $value): int
    {
        return is_int($value) || (is_string($value) && ctype_digit($value)) ? (int) $value : 0;
    }
}
