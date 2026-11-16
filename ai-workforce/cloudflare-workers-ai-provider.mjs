function requireText(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(name + " must be a non-empty string");
  }
  return value.trim();
}

function parseModelJson(content) {
  if (content && typeof content === "object" && !Array.isArray(content)) return content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("CLOUDFLARE_MODEL_RESPONSE_EMPTY");
  }
  const text = content.trim();
  const candidate = text.startsWith("```")
    ? text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : text;
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error("CLOUDFLARE_MODEL_RESPONSE_NOT_VALID_JSON");
  }
}

/**
 * Cloudflare Workers AI REST provider.
 * No network request occurs until generate() is explicitly invoked.
 * The account token is read from the runtime environment and never persisted.
 */
export function createCloudflareWorkersAIProvider({
  accountId = process.env.CLOUDFLARE_ACCOUNT_ID,
  apiToken = process.env.CLOUDFLARE_API_TOKEN,
  model = process.env.CLOUDFLARE_AI_MODEL,
  fetchImpl = globalThis.fetch,
  maxOutputTokens = 1200,
} = {}) {
  const account = requireText(accountId, "CLOUDFLARE_ACCOUNT_ID");
  const key = requireText(apiToken, "CLOUDFLARE_API_TOKEN");
  const selectedModel = requireText(model, "CLOUDFLARE_AI_MODEL");
  if (!/^[a-zA-Z0-9_-]+$/.test(account)) throw new Error("CLOUDFLARE_ACCOUNT_ID_INVALID");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation required");
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 4000) {
    throw new RangeError("CLOUDFLARE_MODEL_TOKEN_LIMIT_OUT_OF_RANGE");
  }

  const modelPath = selectedModel.split("/").map((part) => encodeURIComponent(part)).join("/");
  const endpoint = "https://api.cloudflare.com/client/v4/accounts/" +
    encodeURIComponent(account) + "/ai/run/" + modelPath;

  return Object.freeze({
    async generate({ system, prompt, maxTokens = maxOutputTokens }) {
      if (typeof system !== "string" || typeof prompt !== "string") {
        throw new TypeError("system and prompt must be strings");
      }
      const tokenLimit = Math.min(maxOutputTokens, Number.isInteger(maxTokens) ? maxTokens : maxOutputTokens);
      if (tokenLimit < 1) throw new RangeError("CLOUDFLARE_MODEL_TOKEN_LIMIT_OUT_OF_RANGE");
      const response = await fetchImpl(endpoint, {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          max_tokens: tokenLimit,
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
      });
      if (!response?.ok) throw new Error("CLOUDFLARE_MODEL_HTTP_" + (response?.status ?? "NO_RESPONSE"));
      const body = await response.json();
      if (body?.success === false) {
        throw new Error("CLOUDFLARE_MODEL_API_ERROR");
      }
      const result = body?.result ?? body;
      return parseModelJson(result?.response ?? result?.output ?? result);
    },
  });
}
