<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Which file editor a person uses: the Gobia workspace or the legacy file list with the Monaco editor. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gobia_user_profiles', function (Blueprint $table) {
            $table->string('file_editor', 8)->default('gobia')->after('theme');
        });
    }

    public function down(): void
    {
        Schema::table('gobia_user_profiles', function (Blueprint $table) {
            $table->dropColumn('file_editor');
        });
    }
};
