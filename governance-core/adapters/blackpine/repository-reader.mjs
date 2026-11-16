import { createHash } from "node:crypto";

export const BLACKPINE_SOURCE = Object.freeze({
  owner: "gtmoguap5151",
  repository: "blackpine-field",
});

export const BLACKPINE_READ_PATHS = Object.freeze([
  "README.md",
  "brand-guide.md",
  "launch-slate/01-cordura-vs-ballistic-nylon.md",
  "launch-slate/02-solar-generator-vs-gas-inverter.md",
  "launch-slate/03-best-water-filtration-preparedness.md",
  "site/index.html",
  "site/info.html",
  "site/cordura-vs-ballistic-nylon.html",
  "site/solar-generator-vs-gas-inverter.html",
  "site/best-water-filtration-preparedness.html",
  "site/DEPLOY.md",
]);

const GUIDE_PAIRS = Object.freeze([
  ["launch-slate/01-cordura-vs-ballistic-nylon.md", "site/cordura-vs-ballistic-nylon.html"],
  ["launch-slate/02-solar-generator-vs-gas-inverter.md", "site/solar-generator-vs-gas-inverter.html"],
  ["launch-slate/03-best-water-filtration-preparedness.md", "site/best-water-filtration-preparedness.html"],
]);

const MAX_FILE_BYTES = 100_000;
const MAX_TOTAL_BYTES = 400_000;

function requireRef(ref) {
  if (typeof ref !== "string" || !/^(main|[a-f0-9]{40})$/.test(ref)) {
    throw new TypeError("ref must be main or a full Git commit SHA");
  }
  return ref;
}

function gitBlobSha(content) {
  const bytes = Buffer.from(content, "utf8");
  return createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
    .digest("hex");
}

function sha256(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function getJson(fetchImpl, url) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "application/vnd.github+json" },
    redirect: "error",
  });
  if (!response?.ok) throw new Error(`BLACKPINE_READ_FAILED:${response?.status ?? "NO_RESPONSE"}`);
  return response.json();
}

async function getText(fetchImpl, url) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "text/plain" },
    redirect: "error",
  });
  if (!response?.ok) throw new Error(`BLACKPINE_FILE_READ_FAILED:${response?.status ?? "NO_RESPONSE"}`);
  return response.text();
}

function referenceFor(source, file) {
  return `github://${source.owner}/${source.repository}@${source.ref}/${file.path}#blob=${file.blobSha}&sha256=${file.contentSha256}`;
}

/**
 * Read a fixed allowlist of public Blackpine repository files.
 * This adapter has no write method, accepts no credentials, and issues GET only.
 * File contents are inspected in memory and are not returned in the snapshot.
 */
export async function loadBlackpineSnapshot({ fetchImpl = globalThis.fetch, ref = "main" } = {}) {
  const selectedRef = requireRef(ref);
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");

  const treeUrl = `https://api.github.com/repos/${BLACKPINE_SOURCE.owner}/${BLACKPINE_SOURCE.repository}/git/trees/${selectedRef}?recursive=1`;
  const tree = await getJson(fetchImpl, treeUrl);
  if (tree.truncated) throw new Error("BLACKPINE_REPOSITORY_TREE_TRUNCATED");
  if (!Array.isArray(tree.tree) || typeof tree.sha !== "string") {
    throw new Error("BLACKPINE_REPOSITORY_TREE_INVALID");
  }

  const entries = new Map(
    tree.tree
      .filter((entry) => entry.type === "blob" && BLACKPINE_READ_PATHS.includes(entry.path))
      .map((entry) => [entry.path, entry]),
  );

  const inspected = new Map();
  const files = [];
  let totalBytes = 0;

  for (const path of BLACKPINE_READ_PATHS) {
    const entry = entries.get(path);
    if (!entry) continue;
    if (!Number.isInteger(entry.size) || entry.size < 0 || entry.size > MAX_FILE_BYTES) {
      throw new Error(`BLACKPINE_FILE_SIZE_OUT_OF_RANGE:${path}`);
    }
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const rawUrl = `https://raw.githubusercontent.com/${BLACKPINE_SOURCE.owner}/${BLACKPINE_SOURCE.repository}/${selectedRef}/${encodedPath}`;
    const content = await getText(fetchImpl, rawUrl);
    const byteLength = Buffer.byteLength(content, "utf8");
    totalBytes += byteLength;
    if (byteLength > MAX_FILE_BYTES || totalBytes > MAX_TOTAL_BYTES) {
      throw new Error("BLACKPINE_SNAPSHOT_SIZE_LIMIT_EXCEEDED");
    }
    const actualBlobSha = gitBlobSha(content);
    if (actualBlobSha !== entry.sha || byteLength !== entry.size) {
      throw new Error(`BLACKPINE_FILE_INTEGRITY_MISMATCH:${path}`);
    }
    const file = Object.freeze({
      path,
      blobSha: actualBlobSha,
      byteLength,
      contentSha256: sha256(content),
    });
    files.push(file);
    inspected.set(path, content);
  }

  const homepage = inspected.get("site/index.html") ?? "";
  const brandGuide = inspected.get("brand-guide.md") ?? "";
  const slateFiles = GUIDE_PAIRS.map(([draftPath]) => ({
    path: draftPath,
    content: inspected.get(draftPath) ?? "",
  }));
  const sourceReferenceFiles = slateFiles.filter(({ content }) =>
    /\*\*Sources?\s*\(/i.test(content) || /^#+\s*Sources\b/im.test(content),
  );
  const affiliateDisclosurePresent =
    /some\s+links on this page are affiliate links/i.test(homepage) &&
    /commission\s+at\s+no\s+extra\s+cost/i.test(homepage) &&
    /commissions\s+never\s+change\s+our\s+verdicts/i.test(homepage);
  const handsOnTestingDisclosurePresent =
    /we\s+have\s+not\s+hands-on\s+tested\s+the\s+products\s+covered/i.test(homepage) &&
    /we\s+never\s+invent\s+test\s+results/i.test(homepage);
  const researchOnlyLabelsPresent = slateFiles.every(({ content }) =>
    /research\/spec comparison/i.test(content) &&
    /no hands-on testing is claimed/i.test(content),
  );
  const publishedCompanionsPresent = GUIDE_PAIRS.every(([, publishedPath]) =>
    inspected.has(publishedPath),
  );
  const noHypeBrandRulePresent =
    /no hype/i.test(brandGuide) && /honest limits/i.test(brandGuide);
  const timeSensitivePriceClaimsPresent =
    /\b(?:right now|currently|limited[- ]time|sale ends?|ends? (?:on|by|today|tonight))\b/i.test(homepage) &&
    /\$\s?\d+(?:\.\d{2})?/.test(homepage);

  const source = Object.freeze({
    ...BLACKPINE_SOURCE,
    ref: selectedRef,
    treeSha: tree.sha,
  });

  const evidence = [];
  const homepageFile = files.find((file) => file.path === "site/index.html");
  if (affiliateDisclosurePresent && homepageFile) {
    evidence.push(Object.freeze({
      type: "affiliate-disclosure-check",
      reference: referenceFor(source, homepageFile),
    }));
  }
  for (const item of sourceReferenceFiles) {
    const file = files.find((candidate) => candidate.path === item.path);
    if (file) {
      evidence.push(Object.freeze({
        type: "source-reference-list",
        reference: referenceFor(source, file),
      }));
    }
  }
  for (const item of slateFiles) {
    const file = files.find((candidate) => candidate.path === item.path);
    if (file && item.content.trim()) {
      evidence.push(Object.freeze({
        type: "specification-record",
        reference: referenceFor(source, file),
      }));
    }
  }

  return Object.freeze({
    schemaVersion: "1.0.0",
    source,
    capturedAt: new Date().toISOString(),
    files: Object.freeze(files),
    observations: Object.freeze({
      affiliateDisclosurePresent,
      handsOnTestingDisclosurePresent,
      researchOnlyLabelsPresent,
      publishedCompanionsPresent,
      noHypeBrandRulePresent,
      timeSensitivePriceClaimsPresent,
      sourceReferenceListCount: sourceReferenceFiles.length,
      manufacturerSourceRecordsPresent: false,
      handsOnEvidenceRecordsPresent: false,
    }),
    evidence: Object.freeze(evidence),
    warnings: Object.freeze([
      "This is a read-only snapshot of selected public repository files, not a review of the live website or external affiliate accounts.",
      "A source-reference section is not proof that the cited manufacturer or retailer data has been independently verified.",
      "Repository file hashes establish snapshot integrity, not the truth or accuracy of the statements inside those files.",
    ]),
  });
}
