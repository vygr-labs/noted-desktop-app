# Building & CI/CD

## Local Builds

```bash
# Full production build (all platforms for current OS)
yarn build

# Build without code signing (faster)
yarn build:fast

# Build to directory (no installer, for testing)
yarn build:dir
```

**Important:** Run `yarn cli:build` before `yarn build` if the CLI has changed — the compiled CLI is bundled via `extraResources`.

## GitHub Actions

The workflow (`.github/workflows/build.yml`) builds the app for all three platforms.

### Trigger

Manual only via **Actions > Run workflow**:
- **Platform:** `windows`, `macos`, `linux`, or `all`

### What It Does

1. Checks out the repo
2. Installs dependencies with `yarn install --immutable`
3. Builds the CLI (`yarn cli:build`)
4. Builds the full app (`yarn run build`)
5. Uploads artifacts (`.exe`, `.dmg`, `.AppImage`)

### Downloading Artifacts

1. Go to the **Actions** tab in GitHub
2. Click the workflow run
3. Download artifacts from the **Artifacts** section at the bottom

### Releasing

Builds and releases are on separate accounts. The workflow only produces artifacts — no automatic GitHub Releases.

To release:
1. Run the workflow with platform = `all`
2. Download all artifacts
3. Create a release on the release account and upload them

## Build Targets

| Platform | Format | Config |
|----------|--------|--------|
| Windows | `.exe` (NSIS installer) | `electron-builder.yml` > `win` |
| macOS | `.dmg` | `electron-builder.yml` > `mac` |
| Linux | `.AppImage` | `electron-builder.yml` > `linux` |

## What Gets Bundled

| Path | Description |
|------|-------------|
| `src/backend/build/**` | Compiled backend JS |
| `dist/**` | Built frontend (Astro output) |
| `assets/**` | Icons, images (extraResources) |
| `cli/build/**` | Compiled CLI (extraResources) |
| `app.config.json` | App defaults (extraResources) |
