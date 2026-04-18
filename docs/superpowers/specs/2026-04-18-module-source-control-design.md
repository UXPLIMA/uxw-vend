# Module Source Control

## Problem

First-party modules live in `module-sources/` (dev source) and `src/modules/` (runtime install state). Both are gitignored. Only the built `module-marketplace/*.zip` artifacts are committed. Consequences:

- Module source code has no version control — diffs are binary ZIP rewrites.
- Only one machine holds the authoritative source.
- Refactors that touch module code (e.g. deduping a component across 11 modules) don't persist across re-install from ZIP unless the dev rebuilds the ZIPs and commits them by hand.
- Contributors cannot review module changes through normal PR diffs.

## Goals

- Put first-party module source under version control.
- Preserve the **"Core knows NOTHING about modules"** motto: fresh clone runs with zero modules visible in the product.
- Keep ZIP distribution intact: marketplace installs continue to work unchanged.

## Non-goals

- Splitting modules into separate git repositories or a monorepo toolchain.
- Live sync between `module-sources/` and `src/modules/`.
- Auto-installing first-party modules on fresh clone.
- Pre-commit hooks that rebuild ZIPs on source change.
- Any refactor of module internals.

## Design

Three directories, three roles:

| Directory               | Role                                    | Git status           |
|-------------------------|-----------------------------------------|----------------------|
| `module-sources/`       | Authoritative source for first-party modules | **Tracked** (change) |
| `module-marketplace/*.zip` | Distributable artifacts consumed by admin marketplace install | Tracked (unchanged)  |
| `src/modules/*`         | Runtime install state — what's currently installed on this machine | Gitignored (unchanged) |

### Changes

1. Remove `module-sources/` from `.gitignore`.
2. Commit the existing 41 first-party module sources (~4.1 MB, 338 files; node_modules / .env already absent).
3. Add a "Developing modules" section to `docs/CONTRIBUTING.md`.

### Workflow after the change

- **Edit a first-party module:** change files under `module-sources/<id>/`.
- **Rebuild the ZIPs:** `npm run build:marketplace`.
- **Commit:** source changes + the matching ZIPs in the same commit.
- **Fresh clone:** `npm install` → postinstall regenerates schema / registry → `src/modules/` starts empty → admin installs from marketplace.

### Motto preservation

- Core code never imports from `module-sources/`. Registry generation (`scripts/generate-registry.ts`) walks `src/modules/` only, which is empty on fresh clone.
- `merge-schemas.ts` and `apply-migrations.ts` already consult both directories and prefer the installed copy — unchanged.
- The admin marketplace UI lists entries from `module-marketplace/index.json`; nothing auto-enables modules based on `module-sources/` existence.

### Drift risk

`module-sources/<id>/` and a matching installed `src/modules/<id>/` can diverge after local edits. Not new — pre-existing condition. Mitigation is by convention: dev edits `module-sources/` as the source of truth, re-installs via admin if they need to exercise it at runtime. An optional `npm run modules:diff` verifier is out of scope for this change.

## Implementation

1. Edit `.gitignore`: remove the `module-sources/` line, keep the adjacent `src/modules/*` rule.
2. `git add module-sources/` and commit.
3. Add a short "Developing modules" section to `docs/CONTRIBUTING.md` describing the workflow above.

## Verification

- `git ls-files module-sources/ | wc -l` returns >0.
- `git check-ignore module-sources/store/module.json` returns empty (not ignored).
- `git check-ignore src/modules/store/module.json` still resolves to the gitignore rule.
- `npm run build:marketplace` still produces 41 ZIPs from the now-tracked sources.
- `npm test` passes.
- `npx tsc --noEmit` passes.

## Out of scope (follow-up tickets)

- Dev bootstrap: `npm run modules:install-all` helper that copies every first-party module into `src/modules/` and enables them, for quick local testing.
- Integrity check: `npm run modules:diff` comparing `module-sources/<id>/` contents against the matching `module-marketplace/<id>.zip`.
- Pre-commit hook: detect changes under `module-sources/` and require a matching ZIP rebuild.
- Live sync: symlink / file-watcher mirroring `module-sources/` to `src/modules/` in dev.
