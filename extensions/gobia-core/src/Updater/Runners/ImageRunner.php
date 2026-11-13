<?php

declare(strict_types=1);

namespace GobiaCore\Updater\Runners;

use GobiaCore\Updater\Exceptions\UpdateException;
use GobiaCore\Updater\ProcessRunner;
use GobiaCore\Updater\ReleaseInfo;

/**
 * A Panel that runs from a container image built from a signed release. Its code is part of the image and is never
 * replaced from inside the container: the update is the image of the next signed release. The Updates screen still
 * finds, verifies and reports that release; the preflight only explains how it is installed.
 */
class ImageRunner implements DeploymentRunner
{
    use RunsArtisan;

    public const string MESSAGE = 'This Panel runs from a container image. Install the new version by deploying the image built from the signed release.';

    public function __construct(ProcessRunner $processes)
    {
        $this->processes = $processes;
    }

    public function name(): string
    {
        return 'image';
    }

    public function liveTree(): string
    {
        return base_path();
    }

    public function problems(): array
    {
        return [self::MESSAGE];
    }

    public function install(string $stagedPath, ReleaseInfo $release, string $backupDir): void
    {
        throw new UpdateException(self::MESSAGE);
    }

    public function restoreFiles(string $backupDir): void
    {
        throw new UpdateException(self::MESSAGE);
    }

    public function restartWorkers(): void
    {
        throw new UpdateException(self::MESSAGE);
    }
}
