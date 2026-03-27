import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), "..");

function git(...args) {
  return execFileSync("git", args, { cwd: rootDir, encoding: "utf8" }).trim();
}

function parseTag(tag) {
  const stableMatch = /^v(\d+\.\d+\.\d+)$/.exec(tag);
  if (stableMatch) {
    return { tag, version: stableMatch[1], channel: "release", sequence: 0, prerelease: false };
  }

  const alphaMatch = /^v(\d+\.\d+\.\d+)-alpha(?:\.(\d+))?$/.exec(tag);
  if (alphaMatch) {
    const numeric = alphaMatch[2] === undefined ? 0 : Number(alphaMatch[2]);
    if (![0, 1].includes(numeric)) {
      throw new Error(`Invalid alpha tag '${tag}'. Allowed: vX.Y.Z-alpha, vX.Y.Z-alpha.1`);
    }

    return { tag, version: alphaMatch[1], channel: "alpha", sequence: numeric, prerelease: true };
  }

  const betaMatch = /^v(\d+\.\d+\.\d+)-beta(?:\.(\d+))?$/.exec(tag);
  if (betaMatch) {
    const numeric = betaMatch[2] === undefined ? 0 : Number(betaMatch[2]);
    if (numeric < 0 || numeric > 9) {
      throw new Error(`Invalid beta tag '${tag}'. Allowed: vX.Y.Z-beta through vX.Y.Z-beta.9`);
    }

    return { tag, version: betaMatch[1], channel: "beta", sequence: numeric, prerelease: true };
  }

  const rcMatch = /^v(\d+\.\d+\.\d+)-rc(\d+)?$/.exec(tag);
  if (rcMatch) {
    const numeric = rcMatch[2] === undefined ? 0 : Number(rcMatch[2]);
    if (![0, 1, 2].includes(numeric)) {
      throw new Error(`Invalid rc tag '${tag}'. Allowed: vX.Y.Z-rc, vX.Y.Z-rc1, vX.Y.Z-rc2`);
    }

    return { tag, version: rcMatch[1], channel: "rc", sequence: numeric, prerelease: true };
  }

  throw new Error(
    `Unsupported tag '${tag}'. Allowed examples: v0.0.1-alpha, v0.0.1-alpha.1, v0.0.1-beta, v0.0.1-beta.1, v0.0.1-rc, v0.0.1-rc1, v0.0.1`
  );
}

function normalizeList(output) {
  return output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function previousTagsFor(parsedTag) {
  if (parsedTag.channel === "alpha") {
    return parsedTag.sequence === 1 ? [`v${parsedTag.version}-alpha`] : [];
  }

  if (parsedTag.channel === "beta") {
    const tags = [`v${parsedTag.version}-beta`];
    for (let index = 1; index < parsedTag.sequence; index += 1) {
      tags.push(`v${parsedTag.version}-beta.${index}`);
    }
    return parsedTag.sequence === 0 ? [] : tags;
  }

  if (parsedTag.channel === "rc") {
    if (parsedTag.sequence === 0) {
      return [];
    }

    const tags = [`v${parsedTag.version}-rc`];
    for (let index = 1; index < parsedTag.sequence; index += 1) {
      tags.push(`v${parsedTag.version}-rc${index}`);
    }
    return tags;
  }

  return [];
}

const tagArg = process.argv[2];
const tag = process.env.GITHUB_REF_NAME || tagArg;

if (!tag) {
  console.error("A tag is required. Pass one as an argument or provide GITHUB_REF_NAME.");
  process.exit(1);
}

let parsedTag;

try {
  parsedTag = parseTag(tag);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const allTags = normalizeList(git("tag", "--list", "v*", "--sort=version:refname"));

for (const previousTag of previousTagsFor(parsedTag)) {
  if (!allTags.includes(previousTag)) {
    console.error(`Version policy violation: '${tag}' requires existing tag '${previousTag}'.`);
    process.exit(1);
  }
}

const stableTag = `v${parsedTag.version}`;
if (parsedTag.channel !== "release" && allTags.includes(stableTag)) {
  console.error(`Version policy violation: prerelease '${tag}' is not allowed after stable release '${stableTag}'.`);
  process.exit(1);
}

const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  const lines = [
    `tag=${parsedTag.tag}`,
    `version=${parsedTag.version}`,
    `channel=${parsedTag.channel}`,
    `prerelease=${parsedTag.prerelease ? "true" : "false"}`,
    `release_name=${parsedTag.tag}`
  ];

  execFileSync("node", ["-e", `require('node:fs').appendFileSync(${JSON.stringify(outputFile)}, ${JSON.stringify(`${lines.join("\n")}\n`)})`], {
    cwd: rootDir,
    stdio: "inherit"
  });
}

console.log(`Version policy passed for ${parsedTag.tag} (${parsedTag.channel}).`);