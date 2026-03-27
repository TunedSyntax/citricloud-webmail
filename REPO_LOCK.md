# Repository Lock

This workspace is locked to the `citricloud-webmail` repository.

## What is locked

- Local git hooks reject commits and pushes if the workspace or remote no longer points to `citricloud-webmail`.
- CI rejects workflow or deployment changes that drift toward the separate `citricloud` repository.
- The guard also keeps the CitriCloud webmail branding assets in place and blocks `latest` image tags in deployment manifests.

## Lock status in this repo

- Hook path: `.githooks`
- Local check: `npm run guard:repo`
- Staged-files check: `npm run guard:staged`
- CI workflow: `.github/workflows/repo-guard.yml`

## How to verify the lock

Run these commands inside this repository:

```powershell
git config --get core.hooksPath
npm run guard:repo
```

The expected hook path output is `.githooks`.

## How to unlock it

Only do this if you intentionally want to remove the local lock from this clone.

```powershell
git config --unset core.hooksPath
```

That disables the local hooks for this clone only. The CI workflow will still run on GitHub.

## How to re-lock it

```powershell
git config core.hooksPath .githooks
```

## Scope reminder

- Allowed here: `citricloud-webmail`, `webmail.citricloud.com`, `ghcr.io/tunedsyntax/citricloud-webmail`
- Not allowed here: the separate `citricloud` repo, its workflows, or image references copied from it