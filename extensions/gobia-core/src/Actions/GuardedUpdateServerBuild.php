<?php

declare(strict_types=1);

namespace GobiaCore\Actions;

use GobiaCore\Services\ResourceGuard;
use Pterodactyl\Contracts\Servers\UpdatesServerBuild;
use Pterodactyl\Models\Server;

/** Wraps core build changes with the resource protector: only growth is checked, shrinking is always allowed. */
final readonly class GuardedUpdateServerBuild implements UpdatesServerBuild
{
    public function __construct(private UpdatesServerBuild $inner, private ResourceGuard $guard) {}

    public function update(Server $server, array $input): Server
    {
        $grows = fn (string $field): int => array_key_exists($field, $input)
            ? max(0, GuardedCreateServer::megabytes($input[$field]) - (int) $server->getAttribute($field))
            : 0;
        $this->guard->assertFits($grows('memory'), $grows('disk'));

        return $this->inner->update($server, $input);
    }
}
