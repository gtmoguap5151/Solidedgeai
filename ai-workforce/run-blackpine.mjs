import { createOpenAICompatibleProvider } from "./model-provider.mjs";
import { runBlackpineWorkforce } from "./workforce.mjs";

const workerIds = process.env.GALINYX_WORKERS
  ? process.env.GALINYX_WORKERS.split(",").map((value) => value.trim()).filter(Boolean)
  : undefined;
const ref = process.env.GALINYX_BLACKPINE_REF || "main";
const tokenLimit = process.env.GALINYX_MAX_OUTPUT_TOKENS
  ? Number(process.env.GALINYX_MAX_OUTPUT_TOKENS)
  : 900;

try {
  const provider = createOpenAICompatibleProvider({ maxOutputTokens: tokenLimit });
  const result = await runBlackpineWorkforce({
    provider,
    workerIds,
    ref,
    maxOutputTokensPerWorker: tokenLimit,
  });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} catch (error) {
  process.stderr.write("GALINYX_WORKFORCE_FAILED: " + (error?.message || "unknown error") + "\n");
  process.exitCode = 1;
}
