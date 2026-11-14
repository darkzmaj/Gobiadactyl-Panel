<?php

declare(strict_types=1);

namespace GobiaTemplates\Jobs;

use GobiaTemplates\Models\ServerTemplate;
use GobiaTemplates\Services\TemplateSyncService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Attributes\DeleteWhenMissingModels;
use Illuminate\Queue\Attributes\WithoutRelations;
use Illuminate\Support\Facades\Cache;

/** Rolls a template's current revision out to the servers that follow it (see TemplateSyncService). */
#[DeleteWhenMissingModels]
class SyncTemplateJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 3600;

    public function __construct(
        #[WithoutRelations]
        public readonly ServerTemplate $template,
    ) {
        $this->onQueue('standard');
    }

    public function handle(TemplateSyncService $sync): void
    {
        // One rollout per template at a time; a publish during a rollout runs again once it is done.
        $lock = Cache::lock('sync-template:'.$this->template->uuid, 3600);
        if (! $lock->get()) {
            self::dispatch($this->template)->delay(30);

            return;
        }

        try {
            $sync->rollout($this->template->refresh());
        } finally {
            $lock->release();
        }
    }
}
