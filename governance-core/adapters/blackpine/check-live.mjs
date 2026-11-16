import { loadBlackpineSnapshot } from "./repository-reader.mjs";

const snapshot = await loadBlackpineSnapshot({ ref: "main" });

process.stdout.write(JSON.stringify({
  source: snapshot.source,
  capturedAt: snapshot.capturedAt,
  fileCount: snapshot.files.length,
  files: snapshot.files.map(({ path, blobSha, contentSha256, byteLength }) => ({
    path, blobSha, contentSha256, byteLength,
  })),
  observations: snapshot.observations,
  evidence: snapshot.evidence,
  warnings: snapshot.warnings,
}, null, 2) + "\n");
