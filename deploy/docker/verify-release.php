<?php

declare(strict_types=1);

/*
 * Image build gate: refuses a Gobia release package whose signed manifest does not verify against the trusted
 * public key, or whose archive does not match the signed SHA-256 and size.
 *
 *   php verify-release.php <release.json> <package.tar.gz> <base64 public key>
 */

require __DIR__.'/ReleaseSignature.php';

[, $manifestFile, $package, $publicKey] = $argv + array_fill(0, 4, null);
if (! is_string($manifestFile) || ! is_file($manifestFile) || ! is_string($package) || ! is_file($package) || ! is_string($publicKey)) {
    fwrite(STDERR, "usage: verify-release.php <release.json> <package> <public key>\n");
    exit(2);
}

$fail = static function (string $why): never {
    fwrite(STDERR, "Release rejected: {$why}\n");
    exit(1);
};

$manifest = json_decode((string) file_get_contents($manifestFile), true);
$key = base64_decode($publicKey, true);
$signature = is_array($manifest) && is_string($manifest['signature'] ?? null) ? base64_decode($manifest['signature'], true) : false;
if (! is_array($manifest) || $key === false || strlen($key) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES || $signature === false || strlen($signature) !== SODIUM_CRYPTO_SIGN_BYTES) {
    $fail('the manifest, its signature or the public key is malformed');
}
if (! sodium_crypto_sign_verify_detached($signature, GobiaCore\Updater\ReleaseSignature::message($manifest), $key)) {
    $fail('the signature does not match the trusted public key');
}

$artifact = $manifest['artifact'] ?? [];
if (! is_array($artifact) || ($artifact['size'] ?? null) !== filesize($package) || ! hash_equals((string) ($artifact['sha256'] ?? ''), (string) hash_file('sha256', $package))) {
    $fail('the package does not match the signed SHA-256 and size');
}

echo 'Verified Gobia Panel '.$manifest['gobia_version'].' ('.$artifact['sha256'].")\n";
