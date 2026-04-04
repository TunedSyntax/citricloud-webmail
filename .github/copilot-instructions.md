# CitriCloud Webmail Guardrails

- This repository is only for `citricloud-webmail`.
- Never reuse configuration, workflows, image names, remotes, or deployment values from the separate `citricloud` repository.
- Do not change anything for `api.citricloud.com` here unless the user explicitly asks for a webmail chart-value change and `publicApi.enabled` remains `false`.
- Keep deployment changes scoped to `webmail.citricloud.com`, `ghcr.io/tunedsyntax/citricloud-webmail`, and the manifests under `deploy/`.
- Before proposing deployment edits, verify that `.github/workflows/deploy.yml`, `deploy/k8s/webmail-deployment.yaml`, and `deploy/helm/citricloud-webmail/values.yaml` all still target `citricloud-webmail`.