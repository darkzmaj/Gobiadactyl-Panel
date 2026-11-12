# Security Policy

## Supported versions

Security fixes go into the latest Gobiadactyl Panel release (see [Releases](https://github.com/darkzmaj/Gobiadactyl-Panel/releases)).
Older releases are not patched; update through Admin, Updates.

Problems that also exist in an unmodified Pterodactyl Panel should be reported to the Pterodactyl project as well, following
[their security policy](https://github.com/pterodactyl/panel/security/policy).

## Reporting a vulnerability

Please report privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not use
public issues, discussions or pull requests for security problems.

Include what is affected (version or commit), how to reproduce it, and the impact you expect. You will get an answer as soon as
possible; a fix is released first and the advisory is published afterwards.

## Release integrity

Every release is signed with the Gobia release key (Ed25519, public key
`U/2XlTOgdzsn2lebHDxjkh7HFSNqmYLkm+Hj+3MdVJI=`). The panel's updater and the container build refuse any package whose signature,
SHA-256 or size does not match. Never install a package that fails these checks.
