<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Server templates
|--------------------------------------------------------------------------
|
| Where template files live and how large they may be. Templates can carry any deployment payload: jars, plugins,
| maps, resource packs, configuration. File content is never stored in the database.
*/
return [
    // Private directory (not served by the web server). Each template gets <uuid>/work and <uuid>/blobs.
    'storage' => env('GOBIA_TEMPLATE_STORAGE', storage_path('app/private/templates')),

    'limits' => [
        'max_file_bytes' => (int) env('GOBIA_TEMPLATE_MAX_FILE_BYTES', 1024 * 1024 * 1024),
        'max_total_bytes' => (int) env('GOBIA_TEMPLATE_MAX_TOTAL_BYTES', 8 * 1024 * 1024 * 1024),
        'max_files' => (int) env('GOBIA_TEMPLATE_MAX_FILES', 10000),
        // Files above this size are not opened in the browser editor; they can still be uploaded and downloaded.
        'max_edit_bytes' => 2 * 1024 * 1024,
    ],

    // Files that usually hold secrets (proxy forwarding secrets, environment files). "From a server" does not copy them
    // and following servers never receive them. A pattern with a "/" matches the whole path, otherwise only the file name.
    'secret_files' => [
        'config/paper-global.yml',
        'forwarding.secret',
        '*.secret',
        '.env',
        '.env.*',
    ],

    // Following servers: after a restart a server must report running again within this many seconds, or it is rolled back.
    'sync' => [
        'health_timeout' => (int) env('GOBIA_TEMPLATE_SYNC_HEALTH_TIMEOUT', 180),
        'poll_seconds' => 3,
    ],

    /*
    | SFTP access to a template's working files (see docs/gobia-templates.md). The SFTP service is a separate process;
    | it authenticates against the Panel with this shared token and can reach nothing else.
    */
    'sftp' => [
        'host' => env('GOBIA_SFTP_HOST'),
        'port' => (int) env('GOBIA_SFTP_PORT', 2223),
        'service_token' => env('GOBIA_SFTP_SERVICE_TOKEN'),
        'max_credential_days' => 90,
    ],
];
