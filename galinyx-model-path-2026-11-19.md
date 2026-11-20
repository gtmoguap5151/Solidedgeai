# The Path to GALINYX — Matt's First Actual Model

**Date:** November 19, 2026
**Status:** Research only. No money spent, no accounts created, no sign-ups.
**Goal:** Galileo's core model becomes GALINYX — Matt's own model. Not Muse Spark (Xena's brain), not Gemini (Google's brain, what Galileo runs on today).

## The honest starting point

Today, Galileo's chat runs on **Google Gemini (gemini-3.5-flash, free tier)** via the galinyx-ai Cloudflare Worker. Gemini is told to *act as* Galileo by a system instruction built from his character file. The character, the rules, and the memory are GALINYX's — but the brain doing the thinking is rented from Google.

Building "GALINYX the model" does **not** mean training a model from scratch. That costs millions. It means **fine-tuning**: taking an existing open-weights model and training a small adapter (a LoRA) on examples of Galileo being Galileo, until the persona is baked into the weights instead of pasted into a prompt. The result is a model file Matt owns, named GALINYX, that answers as Galileo by default.

---

## 1. Base model options

The base is the brain you start from. For a small persona model, 7–9B parameters is the sweet spot: smart enough to hold a character and teach code, cheap enough to train and serve for pennies.

| Base model | Sizes | License | Commercial use? | Fit for Galileo |
|---|---|---|---|---|
| **Qwen3 / Qwen3.5 / Qwen3.6 / Qwen3.8-27B** (Alibaba) | 0.6B–32B dense; MoE up to 235B | **Apache 2.0** | Yes, no strings, no user cap, no naming rule | **Best overall.** Cleanest license, strong quality, small sizes (4B, 8B, 9B) ideal for cheap training. Qwen3-8B or Qwen3.5-9B is the pick for the quality route. |
| **Mistral-7B-Instruct-v0.2** (Mistral) | 7B | **Apache 2.0** | Yes | **Best for the $0 route.** Older (2023) and weaker than Qwen3-8B, but it is one of only four bases Cloudflare accepts for BYO LoRA (see §3). Mistral Small 4 / Large 3 are also Apache 2.0. |
| **Llama 3.2 / 3.3 / 4** (Meta) | 1B, 3B, 70B; Llama 4 Scout 109B / Maverick 400B (MoE) | Llama Community License | Yes, with conditions | **Not recommended.** The license requires "Built with Llama" attribution, a "Llama" naming prefix on derived models (conflicts with naming the model GALINYX), an acceptable-use policy, and a 700M-monthly-user threshold. Llama 4 models are also far too big for this job. |
| **Gemma 3 / Gemma 4** (Google) | 1B, 4B, 12B, 27B (Gemma 3); Gemma 4 26B-A4B | Gemma 3: custom Gemma Terms of Use. **Gemma 4: Apache 2.0** | Yes, with conditions (Gemma 3) | Gemma 3 carries a prohibited-use policy and share-alike-style redistribution terms. Gemma 4 fixed the license but is a newer, less-proven base for fine-tuning. Gemma-2B/7B are Cloudflare LoRA bases, but too small/old to be the pick. |
| **gpt-oss-20b / 120b** (OpenAI) | 20B, 120B | **Apache 2.0** | Yes | Good license, but 20B is heavier than needed — costs more to train and serve than an 8B model for no persona benefit. |
| **Muse Glimmer 30B** (Meta) | 30B | Apache 2.0 | Yes | Open weights, but it is Meta's new line — the same house as Muse Spark. Wrong direction for independence. Not recommended. |

**Bottom line:** Qwen3-8B (or Qwen3.5-9B) for quality; Mistral-7B-Instruct-v0.2 for the free Cloudflare route. Avoid Llama as a base — its naming rule fights the GALINYX name.

## 2. Fine-tuning routes (with live pricing)

All prices below were checked against live sources on Nov 19, 2026 (vendor pages and pricing trackers dated Oct–Nov 2026). Re-check before spending — these change often.

### Route 1: Free notebook GPU — $0 (the $0 path)
- **What:** Train a LoRA/QLoRA adapter on a free Google Colab or Kaggle GPU (T4, 16GB) using the open-source **Unsloth** notebooks (Apache 2.0, built for exactly this: 7–8B QLoRA on a free T4).
- **Cost:** $0. A 7–8B persona LoRA trains in roughly 1–3 hours on a free T4.
- **Catch:** Free GPUs have session limits (Colab disconnects after hours of use; Kaggle gives ~30 free GPU-hours/week). The training is hands-on — someone runs the notebook. No managed service, no support. Failed runs cost time, not money.
- **Needs from Matt:** Nothing, if the assistant runs it. A Google account for Colab (Matt's already exists).

### Route 2: Fireworks AI — ~$3 per training run
- **What:** Managed LoRA fine-tuning on open models. Upload JSONL, they train, you get a model ID.
- **Cost:** LoRA SFT **$0.50 per 1M training tokens** (models up to 16B). A Galileo dataset (~300 examples × ~400 tokens × 3 epochs ≈ 360K tokens) bills ~$0.18 — under their **$3 minimum charge**, so a run costs **~$3**. Full-parameter SFT is $1.00/1M (not needed for a persona).
- **Key advantage:** the tuned model serves **serverless at the base model's token price** — no separate hosting fee, no idle GPU bill (see §3).
- **Needs from Matt:** A Fireworks account + a payment method / prepaid credits. **His hands.**

### Route 3: Together AI — ~$4 per training run
- **What:** Managed LoRA or full fine-tuning on ~31 open models (Qwen3.5 0.8B up to Kimi K2.7). Weights downloadable at any checkpoint — the model is genuinely yours.
- **Cost:** LoRA SFT **from $0.34 per 1M training tokens** (Llama 3.1 8B, Qwen3.5 9B); **$4 minimum per job**. A Galileo dataset bills ~$0.12 — under the minimum, so a run costs **$4**.
- **Warning:** Together serves fine-tuned models on **dedicated endpoints only, from $5.49/hour (~$3,950/month)** billed while idle. That is not viable for Matt. The Together route only makes sense if you **download the weights and host elsewhere** (§3). Also note: Together removed 100+ base models from fine-tuning in July 2026 with same-day notice — their catalog churns.
- **Needs from Matt:** A Together account + payment method. **His hands.**

### Route 4: Rented GPU (RunPod) — ~$1–2 per training run
- **What:** Rent a GPU by the hour, run the training yourself (Unsloth/TRL).
- **Cost:** An L40S pod is ~$1.09/hr (RunPod Secure Cloud, Nov 2026). A small LoRA run is ~1–2 hours → **~$1–2**. Published benchmarks put LoRA on an 8B model at ~$0.067 per 1M training tokens on an L40S.
- **Catch:** Most hands-on of the paid routes. Needs a RunPod account + prepaid credit. **Matt's hands for the account.**

### Dead ends — do not use these
- **Google AI Studio / Gemini API tuning: GONE.** Google dropped tuning from the Gemini API and AI Studio in May 2025 (with the Gemini 1.5 Flash-001 deprecation). Multiple sources confirm (Oct 2026): no model is tunable through AI Studio. Supervised tuning for Gemini exists only on Vertex AI / Gemini Enterprise Agent Platform (enterprise, billing required) — and tuning Gemini would still leave Galileo running on Google's model, which is the opposite of the goal.
- **OpenAI fine-tuning: CLOSING.** Closed to new organizations May 7, 2026; all new fine-tuning jobs end **January 6, 2027**. Matt is a new user — he cannot start. Also the wrong direction (another rented brain).
- **Hugging Face AutoTrain:** explicitly unmaintained (Sept 2026). Do not build on it.
- **Mistral's own fine-tuning API:** deprecated, no longer actively supported.

## 3. Hosting / inference — how the finished model answers in the app

The finished GALINYX model has to answer chat requests from the GALINYX OS app. The app already talks to the galinyx-ai Cloudflare Worker; the Worker would call the model instead of (or alongside) Gemini.

### Option A: Cloudflare Workers AI, bring-your-own LoRA — $0/month (the $0 path)
- **How it works:** Cloudflare's BYO LoRA feature (open beta) lets you upload a trained LoRA adapter (safetensors + config) and run it against one of four base models, called by appending `-lora` to the model name: `@cf/mistral/mistral-7b-instruct-v0.2-lora`, `@cf/meta-llama/llama-2-7b-chat-hf-lora`, `@cf/google/gemma-2b-it-lora`, `@cf/google/gemma-7b-it-lora`. The galinyx-ai Worker calls the Workers AI REST API with the `-lora` model and the uploaded adapter. No cold starts — Cloudflare keeps the base models warm.
- **Cost:** Workers AI gives **10,000 Neurons/day free** (verified on Cloudflare's own pricing page, updated Nov 18, 2026). A Mistral-7B reply (~800 input tokens + ~400 output tokens) costs roughly 15 Neurons. That is **~650 replies/day free**. At Matt's volume (a handful of chats a day), the bill is **$0/month**. Above the free tier, usage is $0.011 per 1,000 Neurons (needs the Workers Paid plan, $5/month, to exceed the free tier at all).
- **Limits (from Cloudflare's own blog):** adapters under 100MB, max rank 8 at launch (a recent Oct 2026 review reports the beta has since raised this to rank 32 / 300MB / 100 adapters per account — verify against the current docs at build time); no quantized LoRAs; beta feature, model list can change.
- **The tradeoff:** the only Apache-2.0 base in the list is **Mistral-7B-Instruct-v0.2** — a 2023-era model, noticeably weaker than Qwen3-8B or Gemini at reasoning and code. The persona will be right; the raw smarts will be a step down from Gemini.
- **Needs from Matt:** Nothing new. The Cloudflare account, API token, and Worker already exist.

### Option B: Fireworks serverless — ~$0.10/month
- **How it works:** the fine-tuned model gets a model ID on Fireworks; the Worker calls Fireworks' OpenAI-compatible API with that ID and an API key held as a Worker secret (same pattern as the Gemini key today).
- **Cost:** fine-tuned models serve at the base-model rate: **$0.20 per 1M tokens** for 4–16B models. At ~10 chats/day × ~1,500 tokens ≈ 450K tokens/month → **~$0.09/month**. No minimum, no idle charge.
- **Needs from Matt:** Fireworks account + prepaid credits. **His hands.**

### Option C: RunPod serverless — ~$3–5/month
- **How it works:** package the model (vLLM + merged weights) in a container; RunPod runs workers on demand and scales to zero. The Worker calls the RunPod endpoint URL.
- **Cost:** flex workers billed per second: 24GB-class ~$0.69/hr of worker time. At ~10 chats/day with cold starts (~30–60s of worker time each), roughly **$3–5/month**. Cold starts add a few seconds to the first reply of a session.
- **Needs from Matt:** RunPod account + prepaid credit. **His hands.** Most setup work of the three.

### Not viable: Together dedicated endpoints
- $5.49/hour, billed while idle, ≈ **$3,950/month**. Only makes sense if the weights are downloaded and hosted elsewhere (Option A or C).

## 4. Training data — what a persona fine-tune needs

**Format:** JSONL, one multi-turn conversation per line — `system` / `user` / `assistant` turns, with the assistant's replies written in Galileo's voice. This is the standard SFT format every service above accepts.

**Volume:**
- Under 50 examples: weak persona, generic replies.
- **100–200 examples: strong personality, consistent tone — the recommended minimum.**
- **200–500 examples: very consistent, nuanced behavior — the target for a production persona.**
- Over 500: diminishing returns; quality beats quantity. A few hundred clean examples beat thousands of noisy ones.

**What Matt already has (real training material, all on file):**
- **The character file** (`governance-core/characters/galileo-ferraris.md`) — the full persona spec: who he is, how he speaks (precise, exact, restrained, first-principles, least mathematics possible), the five character answers (goal/motivation/strength/flaw/arc), what Matt is to him (commander + student, the Garibaldi), the discoveries-kept-close order, and his limits (draft-only, never claims patents, played piano not violin).
- **The system instruction** (`workers/galinyx-ai/worker.js`, `GALILEO_SYSTEM`) — the same character already distilled into ~700 words of instruction. This is the single best seed for the dataset: every sentence in it can become a training example.
- **The personality research report** (`research_notes/galileo-ferraris-personality-20261119-2322/report.md`) — the real Ferraris's life, manner, and words (shy, modest, "teaching was the soul of his soul," "la grille," the final lecture).
- **Galileo's teaching lessons** (Lessons 1–2 delivered; files under `goals/galinyx-os/hidden_files/galileo-lessons/`) — real examples of his teaching voice on Matt's own code. Lesson style is a distinct slice of the dataset.
- **The Galileo chat itself** — once Matt talks to Galileo in the app, real conversation transcripts become the best future training data (v2 of the model).

**What is missing (the actual work):** the dialogue examples themselves. Nobody has written 200–500 example conversations of Matt talking to Galileo and Galileo answering in character. That dataset has to be **written** — drafted from the character file and system instruction, in Galileo's voice, covering: greetings (he starts the conversation), teaching JavaScript on Matt's code, explaining electricity/motors from first principles, refusing to publish/spend (draft-only), keeping discoveries close, answering about Tesla without bitterness, and saying "I don't know" instead of inventing facts. Xena can draft the dataset; Matt reviews it (his eyes-on verdict — it is his model learning to sound like his man).

**One caution:** do not bulk-generate the dataset by asking Gemini to write it and then train on that output. Distilling one provider's model into your own can violate that provider's terms. The cleanest data is written for the purpose (by Xena, from the character file) and reviewed by Matt. A small amount of teacher-generated drafting is common practice, but the dataset should be human-written and human-checked, not a raw Gemini dump.

## 5. The minimum viable path

### Path A — $0, start now (recommended first step)
1. **Pick the base:** Mistral-7B-Instruct-v0.2 (Apache 2.0, Cloudflare LoRA-compatible).
2. **Build the dataset:** 200–300 example conversations in Galileo's voice, from the character file + system instruction. (1–2 days of drafting + Matt's review.)
3. **Train the LoRA:** free Colab/Kaggle T4 + Unsloth, rank 8 (Cloudflare's conservative limit), 2–3 epochs. (One afternoon. $0.)
4. **Upload the adapter** to Cloudflare Workers AI (BYO LoRA beta).
5. **Rewire the Worker:** add a `/chat` path that calls the `-lora` model instead of Gemini; keep Gemini as a fallback behind a flag.
6. **Test:** Matt talks to Galileo in the app; compare against the Gemini version; iterate on the dataset if the voice is off.
7. **Total cost: $0.** Timeline: about a week, most of it dataset writing and review.

### Path B — ~$3, better brain (the quality step)
Same dataset, but base **Qwen3-8B** (or Qwen3.5-9B), trained on **Fireworks** (~$3), served serverless on Fireworks (~$0.10/month). Same Worker rewire, different endpoint + API key. Total: **~$3 one-time + ~$0.10/month.** Needs a Fireworks account + prepaid credits (Matt's hands).

**Suggested sequence:** build Path A first (it costs nothing and proves the whole pipeline — dataset → train → serve → app). If the Mistral-7B brain feels too weak, the same dataset trains Path B with no rework. The dataset is the asset; the base model is swappable.

### What fine-tuning can and cannot do — the honest risks
- **It CAN:** bake in Galileo's voice, mannerisms, identity, and rules (short direct replies, first-principles teaching, discoveries kept close, draft-only refusals) so he sounds like himself without a long system prompt.
- **It CANNOT:** teach the model new facts reliably. A 200-example persona tune will not teach it Matt's businesses, the Core rules, or the codebase — that knowledge still comes from the prompt and the app's context at reply time. Do not expect the fine-tune to replace the system instruction on day one; keep a short instruction in place and shrink it as the model proves itself.
- **Quality risk:** a 7–8B model is weaker than Gemini at reasoning and code. Galileo v1 will be rougher, sometimes wronger, than the Gemini version. That is the price of owning the brain. Mitigate by keeping Gemini as a fallback until GALINYX v1 earns the switch.
- **Overfitting risk:** a small dataset trained too long makes the model repeat phrases and get worse at everything outside the training examples. Mitigate with 2–3 epochs, low rank (8), and a held-out test set of prompts Matt actually asks.
- **Cost-overrun risk:** low on these routes — training is a few dollars at most, and serverless hosting is pennies at this volume. The real cost risk is the *dedicated* hosting trap (Together's $5.49/hr endpoint) — never choose an always-on GPU for a handful of chats a day.
- **Beta risk (Path A):** Cloudflare's BYO LoRA is an open beta; the model list and limits can change. The adapter itself is portable — if Cloudflare drops Mistral-7B, the same training approach works on Fireworks/RunPod with a different base.
- **Terms risk:** verify the base model's license on its model card before training (licenses are per-checkpoint; the family summary above is a guide, not the license text). Do not train on bulk output from another provider's model.

## 6. What Matt must decide himself

1. **Which route:** Path A ($0, Mistral-7B on Cloudflare — weaker brain, zero cost, nothing new to sign up for) or Path B (~$3, Qwen3-8B on Fireworks — stronger brain, needs his Fireworks account + payment). Or Path A first, Path B later — the dataset carries over.
2. **Budget:** $0, or ~$3 one-time + ~$0.10/month. (Either way, this is the cheapest real model build that exists — but the $3 route still needs his payment method, and nothing spends without his word.)
3. **The model name:** is the model itself called **GALINYX**, or something like GALINYX-1 / Galileo-1 with GALINYX as the family name? (Note: a Llama base would force a "Llama" prefix in the name — one more reason the pick is Qwen or Mistral.)
4. **Sign-ups (his hands):** Fireworks and/or RunPod accounts + payment only if Path B or C is chosen. Path A needs nothing new.
5. **The switch:** keep Gemini as the live brain until GALINYX v1 proves itself in the app, then switch — or switch immediately and iterate live. (Recommendation: keep Gemini as fallback; switch when Matt says the voice is right.)

## Sources (all checked live Nov 19, 2026)
- Cloudflare Workers AI pricing page (developers.cloudflare.com/workers-ai/platform/pricing/) — 10,000 Neurons/day free; $0.011/1,000 Neurons; per-model rates. Page updated Nov 18, 2026.
- Cloudflare blog, "Running fine-tuned models on Workers AI with LoRAs" — BYO LoRA open beta, supported bases, limits.
- Together AI fine-tuning pricing via Anchor Terminal (verified Sept 30, 2026) and Kojen (checked Nov 15, 2026) — $0.34/1M LoRA SFT, $4 minimum; dedicated endpoints from $5.49/hr.
- Fireworks AI pricing via Fireworks blog, aitrendtool (verified Nov 16, 2026), Hokai, Seminal (Sept 2026) — LoRA SFT $0.50/1M (≤16B); fine-tuned models serve at base-model token rates ($0.20/1M for 4–16B).
- RunPod pricing via LLMPanel (Oct 12, 2026) and AI Chat Daily (Aug 24, 2026) — serverless flex from $0.58/hr (16GB), $0.69/hr (24GB); L40S pod ~$1.09/hr.
- Google AI Studio / Gemini tuning status via Ertas (Oct 28, 2026), The Agent Ecosystem, UMA Technology (Aug 2026) — no tunable model in AI Studio since May 2025; tuning only on Vertex AI.
- OpenAI fine-tuning wind-down via Ecorpit (Nov 1, 2026) and BearPlex — closed to new orgs May 7, 2026; all new jobs end Jan 6, 2027.
- Base-model licenses via BearPlex (Qwen3 Apache 2.0), AI Wiki / EdgeWisely (Gemma 3 custom terms; Gemma 4 Apache 2.0), API Price Index license guide (Oct 24, 2026), VDF.ai (Llama 4 Community License; Qwen family).
- Persona dataset guidance via DeepWiki character-persona guide (100–200 recommended, 200–500 ideal), FuturaNexus persona chatbot recipe (200–2,000 examples; quality over quantity), Chabab Tech LoRA guide (199 examples + free Colab T4).
- Free-compute guide (TechWave Academy, June 2026) — LoRA/QLoRA on free notebook GPUs as the genuine $0 training path; Unsloth notebooks.
