import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const expectedRepoName = "citricloud-webmail";
const expectedImage = "ghcr.io/tunedsyntax/citricloud-webmail";
const expectedRemotePattern = /(^|[/:])citricloud-webmail(?:\.git)?$/i;
const disallowedRepoPatterns = [
  /ghcr\.io\/tunedsyntax\/citricloud(?!-webmail)\b/i,
  /github\.com[/:]TunedSyntax\/citricloud(?!-webmail)(?:\.git)?\b/i,
  /IMAGE_NAME:\s*tunedsyntax\/citricloud(?!-webmail)\b/i
];

const requiredFiles = [
  "apps/web/public/favicon.ico",
  "apps/web/src/assets/logo.svg",
  "apps/web/index.html",
  "apps/web/src/components/AccountSetupWizard.tsx",
  "apps/web/src/components/MailDashboard.tsx",
  "deploy/k8s/webmail-deployment.yaml",
  "deploy/helm/citricloud-webmail/values.yaml",
  ".github/workflows/deploy.yml"
];

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), "..");
const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = modeArg ? modeArg.slice("--mode=".length) : "repo";

function git(...args) {
  return execFileSync("git", args, { cwd: rootDir, encoding: "utf8" }).trim();
}

function normalizeList(output) {
  return output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readWorkspaceFile(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), "utf8");
}

function ensure(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

function getCandidateFiles() {
  if (mode === "staged") {
    return normalizeList(git("diff", "--cached", "--name-only", "--diff-filter=ACMR"));
  }

  return normalizeList(git("ls-files"));
}

const failures = [];
const repoBaseName = path.basename(rootDir);
const remoteUrl = git("remote", "get-url", "origin");
const candidateFiles = new Set(getCandidateFiles());

ensure(repoBaseName === expectedRepoName, `Workspace folder must be '${expectedRepoName}', found '${repoBaseName}'.`, failures);
ensure(expectedRemotePattern.test(remoteUrl), `Git remote must point to '${expectedRepoName}', found '${remoteUrl}'.`, failures);

for (const relativePath of requiredFiles) {
  ensure(existsSync(path.join(rootDir, relativePath)), `Required file is missing: ${relativePath}`, failures);
}

if (mode === "staged" && candidateFiles.size === 0) {
  process.exit(0);
}

for (const relativePath of candidateFiles) {
  const absolutePath = path.join(rootDir, relativePath);

  if (!existsSync(absolutePath)) {
    continue;
  }

  if (/^(node_modules|dist|apps\/proxy\/public|\.git)\b/.test(relativePath)) {
    continue;
  }

  if (/\.(png|jpg|jpeg|gif|webp|ico|woff2?)$/i.test(relativePath)) {
    continue;
  }

  const content = readWorkspaceFile(relativePath);

  for (const pattern of disallowedRepoPatterns) {
    ensure(!pattern.test(content), `Cross-repo reference detected in ${relativePath}: ${pattern}`, failures);
  }
}

const indexHtml = readWorkspaceFile("apps/web/index.html");
const setupWizard = readWorkspaceFile("apps/web/src/components/AccountSetupWizard.tsx");
const dashboard = readWorkspaceFile("apps/web/src/components/MailDashboard.tsx");
const deployment = readWorkspaceFile("deploy/k8s/webmail-deployment.yaml");
const helmValues = readWorkspaceFile("deploy/helm/citricloud-webmail/values.yaml");
const deployWorkflow = readWorkspaceFile(".github/workflows/deploy.yml");

ensure(indexHtml.includes('href="/favicon.ico"'), "apps/web/index.html must reference /favicon.ico.", failures);
ensure(setupWizard.includes('import logoUrl from "../assets/logo.svg";'), "AccountSetupWizard must import the CitriCloud logo asset.", failures);
ensure(dashboard.includes('import logoUrl from "../assets/logo.svg";'), "MailDashboard must import the CitriCloud logo asset.", failures);
ensure(deployment.includes(`image: ${expectedImage}:`), `deploy/k8s/webmail-deployment.yaml must use ${expectedImage}.`, failures);
ensure(!deployment.includes(`${expectedImage}:latest`), "deploy/k8s/webmail-deployment.yaml must not use the latest tag.", failures);
ensure(helmValues.includes(`repository: ${expectedImage}`), "Helm values must point to the citricloud-webmail image repository.", failures);
ensure(!/\btag:\s*latest\b/.test(helmValues), "Helm values must not use the latest image tag.", failures);
ensure(/publicApi:\s*[\s\S]*?enabled:\s*false/.test(helmValues), "Helm values must keep publicApi.enabled set to false.", failures);
ensure(deployWorkflow.includes("IMAGE_NAME: tunedsyntax/citricloud-webmail"), "Deploy workflow must target the citricloud-webmail image.", failures);

if (failures.length > 0) {
  console.error("Repository guard failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Repository guard passed (${mode}).`);