# GALINYX AI Workforce v1 — BLACKPINE FIELD operating cell

The AI Workforce is a specialist-worker layer inside GALINYX OS. It is not a separate platform. The GALINYX Governance Core remains the authority and policy layer.

## First workforce

| Worker | Responsibility |
|---|---|
| Chief of Staff | Synthesize findings, rank priorities, expose dependencies |
| Research & Evidence Analyst | Source quality, evidence gaps, uncertainty |
| Content Integrity Editor | Editorial quality, disclosures, product-claim boundaries |
| Revenue & Affiliate Operations Analyst | Click-to-commission measurement and revenue evidence |
| SEO & Distribution Analyst | Discoverability and distribution opportunities |
| Operations & Risk Officer | Dependencies, controls, release and rollback risk |

## Current operating model

1. Read one fixed, public, allowlisted BLACKPINE FIELD repository snapshot.
2. Verify repository file integrity through the existing read-only adapter.
3. Give each selected specialist the same bounded evidence snapshot.
4. Call an explicitly configured model provider: an OpenAI-compatible endpoint or Cloudflare Workers AI REST API.
5. Validate the model's JSON output and reject evidence references that are not in the snapshot.
6. Convert proposed actions into human-review packets.
7. Return a structured operating report. No external action is executed.

Workers run sequentially to make model-call count and cost easier to understand. The caller chooses the worker list. Each call has a bounded output-token limit. No model request occurs merely by importing the package.

## Model configuration

No provider is selected and no credentials are stored in the repository. Choose one provider and configure its environment variables in the runtime that will execute the workforce. For an OpenAI-compatible endpoint:

- `GALINYX_MODEL_BASE_URL` — HTTPS base URL for an OpenAI-compatible API (include `/v1` when required by the provider).
- `GALINYX_MODEL_API_KEY` — provider key, stored as a secret in the deployment environment.
- `GALINYX_MODEL_NAME` — exact model identifier supported by that endpoint.

The CLI selects the provider with `GALINYX_MODEL_PROVIDER`. Set it to `cloudflare-workers-ai` to use the Cloudflare Workers AI adapter, which calls the account REST endpoint directly and does not require an AI Gateway. Configure `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_AI_MODEL` instead of the OpenAI-compatible variables. The default provider remains `openai-compatible` for backward compatibility. Store the token as a runtime secret; never commit it. The endpoint is not called until the application explicitly constructs a provider and calls `runBlackpineWorkforce()`. Provider pricing, model availability, rate limits, data retention, and model quality must be checked before enabling paid inference. The test suite uses fixture responses and makes no paid model calls.

## Governance boundary — important

This milestone is an AI worker orchestration and proposal layer, **not a completed production Governance Core integration**.

- The current BLACKPINE Governance Core PR branch contains an in-memory decision engine and authority registry for tests.
- Those components are not durable production identity or authorization infrastructure.
- Workforce packets are explicitly marked `awaiting_human_review`.
- This milestone does not invoke the Governance Core decision engine, authenticate the owner, create a real approval, or authorize execution.
- Workers cannot publish, deploy, spend, send outreach, change prices, alter affiliate links, access financial settings, or modify repositories.
- A future integration must submit proposals through the real policy evaluator, derive human identity from a trusted identity provider, persist approvals and audit events, and keep execution behind a separate allowlisted service boundary.

Do not describe these packets as approved governance decisions. Do not connect write-capable tools until those production gates are independently reviewed.

## Tests

Requires Node.js 20 or later:

```sh
node --test ai-workforce/test/*.test.mjs
```

The tests use a fixture model provider and a fixture snapshot. They verify worker selection, shared snapshot use, bounded outputs, evidence-reference validation, secure endpoint configuration, and the human-review-only boundary.

## Current status

- Implemented: six worker definitions, sequential orchestration, OpenAI-compatible and Cloudflare Workers AI provider adapters, bounded prompt and output validation, evidence-reference allowlist, human-review packet format, tests.
- Not yet implemented: live model provider configuration, real run against BLACKPINE FIELD, production authentication, durable job queue, persistent worker memory, user interface, Governance Core decision-engine integration, write-capable actions.
