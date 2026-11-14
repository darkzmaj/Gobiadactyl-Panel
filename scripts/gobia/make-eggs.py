"""Generates the Gobiadactyl runtime eggs (PTDL_v2) for PumpkinMC, DivineMC, CanvasMC, Gate and Gate Lite.

Every egg installs a pinned artifact from a GitHub release (repo + tag + asset pattern, private repos via an
admin-only token) or from a direct URL, verifies an optional SHA-256, and records what it installed in
.gobia-artifact. Run: python scripts/gobia/make-eggs.py  (writes database/Seeders/eggs/gobiadactyl/egg-*.json and self-checks them).
"""
import json
import pathlib

OUT = pathlib.Path(__file__).resolve().parents[2] / "database" / "Seeders" / "eggs" / "gobiadactyl"

INSTALL = r"""#!/bin/ash
# Gobiadactyl artifact installer: pinned GitHub release asset or direct URL, optional SHA-256 check.
set -eu
apk add --no-cache curl jq >/dev/null
mkdir -p /mnt/server && cd /mnt/server

case "$(uname -m)" in
  x86_64) ARCH=amd64; ARCH_UP=X64 ;;
  aarch64) ARCH=arm64; ARCH_UP=ARM64 ;;
  *) echo "Unsupported CPU architecture: $(uname -m)"; exit 1 ;;
esac
TARGET="__TARGET__"
AUTH=""
[ -n "${ARTIFACT_TOKEN:-}" ] && AUTH="Authorization: Bearer ${ARTIFACT_TOKEN}"

if [ -n "${ARTIFACT_URL:-}" ]; then
  URL="$ARTIFACT_URL"; TAG="${ARTIFACT_TAG:-direct}"; ACCEPT="*/*"
else
  [ -n "${ARTIFACT_REPO:-}" ] || { echo "Set ARTIFACT_REPO (owner/name) and ARTIFACT_TAG, or ARTIFACT_URL."; exit 1; }
  API="https://api.github.com/repos/${ARTIFACT_REPO}/releases"
  if [ "${ARTIFACT_TAG:-latest}" = "latest" ]; then REL="$API/latest"
  else REL="$API/tags/$(printf %s "$ARTIFACT_TAG" | jq -sRr @uri)"; fi
  JSON=$(curl -fsSL -H "Accept: application/vnd.github+json" ${AUTH:+-H "$AUTH"} "$REL") \
    || { echo "Release not found: ${ARTIFACT_REPO} ${ARTIFACT_TAG:-latest}"; exit 1; }
  TAG=$(echo "$JSON" | jq -r .tag_name)
  VERSION=${TAG#v}
  PATTERN=$(printf %s "$ARTIFACT_ASSET" | sed -e "s/{arch}/$ARCH/g" -e "s/{ARCH}/$ARCH_UP/g" -e "s/{version}/$VERSION/g")
  URL=$(echo "$JSON" | jq -r --arg p "$PATTERN" '[.assets[] | select(.name | test("^" + $p + "$"))][0].url // empty')
  [ -n "$URL" ] || { echo "No asset matching ^${PATTERN}\$ in ${ARTIFACT_REPO} ${TAG}"; echo "$JSON" | jq -r '.assets[].name'; exit 1; }
  ACCEPT="application/octet-stream"
fi

echo "Downloading ${TAG} -> ${TARGET}"
curl -fL --retry 3 -H "Accept: $ACCEPT" ${AUTH:+-H "$AUTH"} -o "${TARGET}.download" "$URL"
SUM=$(sha256sum "${TARGET}.download" | cut -d' ' -f1)
if [ -n "${ARTIFACT_SHA256:-}" ] && [ "$SUM" != "$(echo "$ARTIFACT_SHA256" | tr 'A-F' 'a-f')" ]; then
  rm -f "${TARGET}.download"; echo "SHA-256 mismatch: got $SUM, expected $ARTIFACT_SHA256"; exit 1
fi
[ -f "$TARGET" ] && mv -f "$TARGET" "${TARGET}.previous"
mv "${TARGET}.download" "$TARGET"
__POST__
printf 'source=%s\ntag=%s\nsha256=%s\ninstalled_at=%s\n' "${ARTIFACT_URL:-$ARTIFACT_REPO}" "$TAG" "$SUM" "$(date -u +%FT%TZ)" > .gobia-artifact
echo "Installed ${TAG} (sha256 ${SUM})"
"""


def var(name, env, default, desc, rules, viewable=True, editable=True):
    return {"name": name, "description": desc, "env_variable": env, "default_value": default,
            "user_viewable": viewable, "user_editable": editable, "rules": rules, "field_type": "text"}


def artifact_vars(repo, tag, asset, asset_desc):
    return [
        var("Artifact repository", "ARTIFACT_REPO", repo,
            "GitHub repository (owner/name) whose release holds the build. Point it at your fork.",
            "nullable|string|regex:/^[\\w.-]+\\/[\\w.-]+$/", editable=False),
        var("Release tag", "ARTIFACT_TAG", tag,
            "Pinned release tag to install (reinstall to change it). 'latest' follows the newest release; avoid it in production.",
            "required|string|max:100", editable=False),
        var("Release asset pattern", "ARTIFACT_ASSET", asset, asset_desc + " Regex, anchored; {arch} = amd64/arm64, {ARCH} = X64/ARM64, {version} = tag without a leading v.",
            "required|string|max:200", editable=False),
        var("Direct download URL", "ARTIFACT_URL", "",
            "Overrides the repository and tag: download this URL instead.", "nullable|url|max:500",
            viewable=False, editable=False),
        var("Expected SHA-256", "ARTIFACT_SHA256", "",
            "Optional. The install fails if the download does not match.", "nullable|regex:/^[A-Fa-f0-9]{64}$/",
            viewable=False, editable=False),
        var("GitHub token (private repos)", "ARTIFACT_TOKEN", "",
            "Optional read-only token (Contents: read) for a private release. Admin only.", "nullable|string|max:255",
            viewable=False, editable=False),
    ]


JAVA_IMAGES = {"Java 25": "ghcr.io/pterodactyl/yolks:java_25", "Java 21": "ghcr.io/pterodactyl/yolks:java_21"}
JVM_FLAGS = ("-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions "
             "-XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 "
             "-XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 "
             "-XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 "
             "-XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1")

PAPER_CONFIG = json.dumps({"server.properties": {"parser": "properties", "find": {
    "server-ip": "0.0.0.0", "server-port": "{{server.build.default.port}}", "query.port": "{{server.build.default.port}}"}}},
    indent=4)


def java_egg(name, desc, repo, tag, asset):
    startup = ("java -Xms128M -XX:MaxRAMPercentage={{MAX_RAM_PERCENT}} {{JVM_FLAGS}} -Dterminal.jline=false "
               "-Dterminal.ansi=true -jar {{SERVER_JARFILE}} --nogui --config {{SERVER_PROPERTIES}} "
               "--bukkit-settings {{BUKKIT_CONFIG}} --spigot-settings {{SPIGOT_CONFIG}} "
               "--paper-settings-directory {{PAPER_CONFIG_DIR}} {{SERVER_ARGS}}")
    post = '[ -f server.properties ] || printf "server-port=25565\\nserver-ip=0.0.0.0\\n" > server.properties'
    return {
        "name": name, "description": desc, "features": ["eula", "java_version", "pid_limit"],
        "docker_images": JAVA_IMAGES, "startup": startup,
        "config": {"files": PAPER_CONFIG, "startup": json.dumps({"done": ")! For help, type "}), "logs": "{}", "stop": "stop"},
        "target": "{{SERVER_JARFILE}}", "post": post,
        "variables": artifact_vars(repo, tag, asset, "Jar asset name in the release.") + [
            var("Server jar file", "SERVER_JARFILE", "server.jar", "File the build is saved as and started from.",
                "required|regex:/^([\\w\\d._-]+)(\\.jar)$/", editable=False),
            var("Max RAM percent", "MAX_RAM_PERCENT", "90", "Heap limit as a share of the container memory.",
                "required|integer|between:50,95"),
            var("JVM flags", "JVM_FLAGS", JVM_FLAGS, "Extra JVM flags (default: Aikar's G1 flags).",
                "nullable|string|max:2000", editable=False),
            var("server.properties path", "SERVER_PROPERTIES", "server.properties",
                "Path of server.properties. The panel sets the port only in ./server.properties.",
                "required|string|regex:/^[\\w.\\/-]+$/|max:200", editable=False),
            var("bukkit.yml path", "BUKKIT_CONFIG", "bukkit.yml", "Path of bukkit.yml.",
                "required|string|regex:/^[\\w.\\/-]+$/|max:200", editable=False),
            var("spigot.yml path", "SPIGOT_CONFIG", "spigot.yml", "Path of spigot.yml.",
                "required|string|regex:/^[\\w.\\/-]+$/|max:200", editable=False),
            var("Paper config directory", "PAPER_CONFIG_DIR", "config",
                "Directory with paper-global.yml, paper-world-defaults.yml and the fork's own config files.",
                "required|string|regex:/^[\\w.\\/-]+$/|max:200", editable=False),
            var("Extra server arguments", "SERVER_ARGS", "", "Appended to the server command line.",
                "nullable|string|max:500", editable=False),
        ],
    }


def egg(name, desc, images, startup, config, target, post, variables, features=()):
    return {"name": name, "description": desc, "features": list(features), "docker_images": images,
            "startup": startup, "config": config, "target": target, "post": post, "variables": variables}


DEBIAN = {"Debian 12 (glibc 2.36)": "ghcr.io/ptero-eggs/yolks:debian"}
GATE_ASSET = "gate_{version}_linux_{arch}"
GATE_CONFIG_FULL = r"""[ -f "${CONFIG_FILE}" ] || cat > "${CONFIG_FILE}" <<'EOF'
# Gate full proxy. Docs: https://gate.minekube.com/guide/config/
config:
  bind: 0.0.0.0:25565
  onlineMode: true
  servers:
    lobby: localhost:25566
  try:
    - lobby
api:
  enabled: false
EOF"""
GATE_CONFIG_LITE = r"""[ -f "${CONFIG_FILE}" ] || cat > "${CONFIG_FILE}" <<'EOF'
# Gate Lite: routes connections by the hostname players connect with. Docs: https://gate.minekube.com/guide/lite
config:
  bind: 0.0.0.0:25565
  lite:
    enabled: true
    routes:
      - host: play.example.com
        backend: localhost:25566
api:
  enabled: false
EOF"""


def gate_egg(name, desc, post):
    return egg(name, desc, DEBIAN, "./gate --config {{CONFIG_FILE}} {{GATE_ARGS}}",
               {"files": json.dumps({"config.yml": {"parser": "yaml", "find": {
                   "config.bind": "0.0.0.0:{{server.build.default.port}}"}}}, indent=4),
                "startup": json.dumps({"done": "listening for connections"}), "logs": "{}", "stop": "^C"},
               "gate", "chmod 0755 gate\n" + post,
               artifact_vars("minekube/gate", "v0.80.3", GATE_ASSET, "Linux binary asset name.") + [
                   var("Config file", "CONFIG_FILE", "config.yml",
                       "Gate configuration file. The panel sets the bind port only in ./config.yml.",
                       "required|string|regex:/^[\\w.\\/-]+\\.ya?ml$/|max:200", editable=False),
                   var("Extra Gate arguments", "GATE_ARGS", "", "Appended to the gate command line (e.g. --debug).",
                       "nullable|string|max:300", editable=False),
               ])


PUMPKIN_STARTUP = (r"""[ -f pumpkin.toml ] && sed -i '/^\[networking.java\]/,/^\[/ s|^address = .*|address = "0.0.0.0:{{SERVER_PORT}}"|' pumpkin.toml; """
                   "./pumpkin {{PUMPKIN_ARGS}}")

EGGS = {
    "pumpkinmc": egg(
        "PumpkinMC", "Pumpkin, a Minecraft server written in Rust (Gobiadactyl fork). Native Linux binary.",
        DEBIAN, PUMPKIN_STARTUP,
        {"files": "{}",
         "startup": json.dumps({"done": "Started server; took"}), "logs": "{}", "stop": "stop"},
        "pumpkin", "chmod 0755 pumpkin\n# pumpkin.toml is created on first start; the startup command sets [networking.java] address to the allocation port.",
        artifact_vars("Pumpkin-MC/Pumpkin", "0.2.2+26.3-26.60", "pumpkin-{ARCH}-Linux",
                      "Linux binary asset name (upstream also ships pumpkin-X64-v3-Linux for AVX2 CPUs).") + [
            var("Extra arguments", "PUMPKIN_ARGS", "", "Appended to the pumpkin command line.", "nullable|string|max:300",
                editable=False),
            var("Rust backtrace", "RUST_BACKTRACE", "1", "Backtraces on crashes (0, 1 or full).", "required|in:0,1,full",
                editable=False),
        ]),
    "divinemc": java_egg("DivineMC", "DivineMC, a Paper/Purpur fork focused on performance (Gobiadactyl fork).",
                         "", "latest", "divinemc-.*\\.jar"),
    "canvasmc": java_egg("CanvasMC", "CanvasMC, a Folia fork with region threading (Gobiadactyl fork).",
                         "", "latest", "canvas-.*\\.jar"),
    "gate": gate_egg("Gate", "Gate full proxy (BungeeCord/Velocity replacement, Gobiadactyl fork): server switching, commands.",
                     GATE_CONFIG_FULL),
    "gate-lite": gate_egg("Gate Lite", "Gate in Lite mode (Gobiadactyl fork): routes players by hostname to backends, no server switching.",
                          GATE_CONFIG_LITE),
}

for slug, e in EGGS.items():
    script = INSTALL.replace("__TARGET__", e.pop("target").replace("{{SERVER_JARFILE}}", "${SERVER_JARFILE}")) \
                    .replace("__POST__", e.pop("post"))
    doc = {"_comment": "Gobiadactyl runtime template. Generated by make_eggs.py.",
           "meta": {"version": "PTDL_v2", "update_url": None}, "exported_at": "2026-11-14T00:00:00+00:00",
           "name": e["name"], "author": "gobiadactyl@gobia.cloud", "description": e["description"],
           "features": e["features"], "docker_images": e["docker_images"], "file_denylist": [],
           "startup": e["startup"], "config": e["config"],
           "scripts": {"installation": {"script": script, "container": "ghcr.io/pterodactyl/installers:alpine",
                                        "entrypoint": "ash"}},
           "variables": e["variables"]}
    # Self-check: every {{VAR}} in startup is a declared variable (or a server.* placeholder), and JSON strings parse.
    import re
    declared = {v["env_variable"] for v in doc["variables"]}
    used = set(re.findall(r"{{([A-Z_]+)}}", doc["startup"]))
    assert used <= declared | {"SERVER_PORT", "SERVER_MEMORY", "SERVER_IP"}, (slug, used - declared)
    for k in ("files", "startup", "logs"):
        json.loads(doc["config"][k])
    assert "__TARGET__" not in script and "__POST__" not in script
    (OUT / f"egg-{slug}.json").write_text(json.dumps(doc, indent=4) + "\n", encoding="utf-8")
    print("wrote", f"egg-{slug}.json", "vars:", len(declared))
