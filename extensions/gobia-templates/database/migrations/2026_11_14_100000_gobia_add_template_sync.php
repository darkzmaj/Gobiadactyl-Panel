<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gobia_server_templates', function (Blueprint $table): void {
            // Folders and files (relative paths) that following servers keep in step with the template. Empty: nothing syncs.
            $table->text('sync_paths')->nullable()->after('allow_instance_delete');
        });

        Schema::table('gobia_template_instances', function (Blueprint $table): void {
            $table->boolean('follow')->default(false)->after('stage_ms');
            // The template revision whose synced files the server has; null means the revision it was created from.
            $table->unsignedInteger('synced_revision')->nullable()->after('follow');
            $table->string('sync_state', 16)->nullable()->after('synced_revision');
            $table->string('sync_error', 500)->nullable()->after('sync_state');
            $table->timestamp('synced_at')->nullable()->after('sync_error');
        });
    }

    public function down(): void
    {
        Schema::table('gobia_template_instances', function (Blueprint $table): void {
            $table->dropColumn(['follow', 'synced_revision', 'sync_state', 'sync_error', 'synced_at']);
        });

        Schema::table('gobia_server_templates', function (Blueprint $table): void {
            $table->dropColumn('sync_paths');
        });
    }
};
