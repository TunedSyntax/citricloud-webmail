# citricloud-webmail

Professional webmail client for CitriCloud with a React dashboard and a Node.js IMAP/SMTP proxy designed for K3S deployment.

## Architecture

- `apps/web`: React + Vite + Tailwind frontend with setup wizard and professional dashboard shell.
- `apps/proxy`: Express-based web-to-IMAP bridge using `imapflow` and `nodemailer`.
- `Dockerfile`: Single-container production image that serves the built frontend through the proxy API.

## CitriCloud server presets

- `EXTERNAL` (`K3S-Prod`): `mail.citricloud.com`, domain suffix `<external-mail-domain>`
- `INTERNAL` (`K3S-Mgmt`): `ems.citricloud.com`, domain suffix `<internal-mail-domain>`

The setup wizard automatically recommends the correct profile from the supplied mailbox address and lets operators override the connection settings when needed.

## Development

```bash
npm install
npm run dev:proxy
npm run dev:web
```

Frontend dev server: `http://localhost:5173`

Proxy API: `http://localhost:8080`

Public production URL: `https://webmail.citricloud.com`

Saved browser sessions are restored automatically and the account menu now supports switching between previously authenticated accounts or signing out of the current session.

## Repository guardrails

This repository is intentionally locked to `citricloud-webmail` so it does not drift into the separate `citricloud` repo configuration.

```bash
npm run guard:repo
```

Local hook setup and unlock instructions are documented in `REPO_LOCK.md`.

## Version policy

GitHub tags and releases follow a strict manual sequence:

- Alpha: `v0.0.1-alpha`, `v0.0.1-alpha.1`
- Beta: `v0.0.1-beta` through `v0.0.1-beta.9`
- Release candidate: `v0.0.1-rc`, `v0.0.1-rc1`, `v0.0.1-rc2`
- Stable release: `v0.0.1`

Rules:

- `alpha`, `beta`, and `rc` are GitHub prereleases.
- Versions must not skip within the same track.
- A stable release blocks later prereleases for the same base version.

Validate a tag locally with:

```bash
npm run guard:version -- v0.0.1-beta.4
```

Production visibility is driven by the last deployed tag. A plain edit in VS Code does not change `webmail.citricloud.com` until you push a version tag that triggers the deploy workflow.

## Session storage

The proxy no longer keeps authenticated sessions in-memory.

- Default local mode uses encrypted file-backed storage at `./data/sessions.enc.json`.
- K3S-ready mode uses Redis-backed sessions by setting `SESSION_STORAGE=redis` and `REDIS_URL`.

Use `.env.example` as the base for local configuration or cluster secrets.

For CitriCloud mail infrastructure with an internal or self-signed chain, keep `MAIL_TLS_REJECT_UNAUTHORIZED=false` so IMAP and SMTP verification does not fail during login.

## Production image

```bash
docker build -t citricloud-webmail .
docker run -p 8080:8080 citricloud-webmail
```

## K3S deployment

Deployment manifests are included under `deploy/k8s` and cover the webmail app, ingress, and a Redis session store.

```bash
kubectl apply -k deploy/k8s
```

Before applying, create a real secret manifest from the template and avoid committing it:

```powershell
$sessionKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 48 | ForEach-Object {[char]$_})
$redisPassword = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
(Get-Content deploy/k8s/secrets-template.yaml) `
	-replace 'replace-with-a-long-random-secret', $sessionKey `
	-replace 'replace-with-a-redis-password', $redisPassword |
	Set-Content deploy/k8s/secrets.local.yaml
kubectl apply -f deploy/k8s/secrets.local.yaml
kubectl apply -k deploy/k8s
```

Adjust the ingress hostname if your public endpoint differs from `webmail.citricloud.com`.

## Helm chart

A deployable Helm chart is included under `deploy/helm/citricloud-webmail` for environments where raw manifests are not enough.

```bash
helm upgrade --install citricloud-webmail deploy/helm/citricloud-webmail \
	--namespace citricloud-webmail \
	--create-namespace \
	--set secrets.sessionEncryptionKey=... \
	--set secrets.redisPassword=...
```

## Notes

- The dashboard now includes compose and reply flows connected to the proxy send endpoint.
- Redis-backed sessions are the recommended runtime mode for multi-replica K3S deployments.
- The ingress manifest assumes Traefik as the K3S ingress controller.
- Helm is not required, but the chart mirrors the K3S manifest settings and is the faster path for parameterized rollouts.
