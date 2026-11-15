# GALINYX OS — Product Foundation

**Status:** Foundational product direction  
**Document type:** Living architecture and roadmap  
**Source of truth:** GitHub repository; update this document when product decisions change.

## 1. Product thesis

GALINYX OS is intended to become a human-directed, AI-native operating environment: a connected system in which people can create, organize, operate, experience, and eventually inhabit persistent digital worlds.

It is not merely a chatbot, a task manager, a collection of AI tools, or a conventional desktop shell. Those may be interfaces or capabilities inside the larger system. The long-term product is the connected environment and the relationships between its parts.

**North-star:** Give people a coherent place to direct intelligent tools, build and own digital work, participate in creator economies, and eventually extend parts of their identity and experiences into persistent virtual environments.

## 2. Product layers

These are layers of one ecosystem, not four unrelated products.

### Layer A — GALINYX OS Core
The foundational operating environment and control plane.

- Consistent user identity, profile, preferences, and permissions.
- Project/workspace model for goals, files, decisions, tasks, and history.
- Shared context/memory with user visibility, correction, export, and deletion controls.
- Capability and integration registry for tools, services, agents, and connected applications.
- Action system distinguishing suggestions, drafts, approved actions, and completed actions.
- Auditable event history for consequential actions.

### Layer B — Intelligence and Agent Runtime
The system that makes the environment intelligent.

- Model/provider abstraction so intelligence is not hard-wired to one vendor.
- Tool-using agents with scoped permissions and explicit execution boundaries.
- Context retrieval from user-approved workspaces and connected sources.
- Human review for consequential, external, financial, identity, or irreversible actions.
- Provenance separating user facts, retrieved evidence, model suggestions, and verified outcomes.
- Evaluation, observability, cost controls, and failure recovery.

### Layer C — Creator and Developer Ecosystem
The extensibility and economic layer.

- Developer interface/SDK and documented capability contracts.
- Catalog/marketplace for tools, agents, experiences, and creator offerings.
- Versioning, permissions, compatibility, trust signals, and security review.
- Creator profiles, attribution, licensing/usage terms, and transparent monetization.
- A path for independent developers to build once and reach users across the ecosystem.

### Layer D — Life Simulator and Digital Experiences
The long-horizon experiential layer.

- Persistent virtual environments and user-directed experiences.
- Configurable avatars/digital representations controlled by their owners.
- Identity and asset portability subject to explicit permissions.
- Social, collaborative, learning, work, entertainment, and simulation experiences.
- Clear boundaries between a real person, an avatar, generated representations, and autonomous agents.
- Privacy, safety, consent, moderation, and controls over what an avatar or agent may do.

The Life Simulator is a future product layer, not a claim that GALINYX currently has avatar, simulation, or virtual-world functionality.

## 3. Shared platform primitives

Build around stable concepts rather than isolated screens:

1. **Identity** — who a user or service is, and what it is allowed to access.
2. **Workspace** — the container for a person's or team's work.
3. **Project** — a goal-oriented unit with its own context, resources, and state.
4. **Artifact** — a document, design, dataset, asset, model output, or other created object.
5. **Memory** — a sourced, scoped, revisable record of context; never an invisible source of truth.
6. **Capability** — a tool or operation an agent or user can invoke under defined permissions.
7. **Agent** — a configured actor that reasons and uses capabilities within a bounded scope.
8. **Experience** — an interactive product or environment assembled from capabilities and assets.
9. **Asset** — a digital object with ownership, provenance, permissions, and lifecycle metadata.
10. **Event** — a record of an important state change or action, including who/what initiated it.

These primitives should allow a project created in the core to connect later to a creator tool, an agent, or a Life Simulator experience without being rebuilt from scratch.

## 4. Non-negotiable product principles

- **Human-directed by default:** users control goals, permissions, and consequential decisions.
- **Useful before autonomous:** establish reliable workflows before expanding agent autonomy.
- **Truthful capability claims:** never present a planned feature as shipped or a draft as a verified result.
- **Portable by design:** users can export their data and avoid unnecessary lock-in.
- **Privacy and security as architecture:** least privilege, scoped access, secure secrets, and explicit consent.
- **Interoperable:** prefer documented APIs and stable contracts over one-off integrations.
- **Economic transparency:** disclose fees, revenue shares, ownership terms, and monetization mechanics.
- **Accessible and device-aware:** the core experience must work well on mobile, not just desktop.
- **Composable:** features reuse shared identity, context, permission, and artifact systems.

## 5. Current implementation reality

The repository contains an early browser-based workspace prototype under `galinyx-site/`.

Verified in the current source:
- Overview dashboard.
- Creator Studio that structures user input into local drafts.
- Project Memory stored in browser local storage.
- Task Planner.
- Local Activity Log.
- JSON workspace export/import.
- Responsive layout and service-worker registration.

Not currently connected in that prototype:
- User accounts or cross-device synchronization.
- Server-side database or durable cloud storage.
- AI model inference or agent execution.
- External integrations or developer SDK.
- Marketplace, payments, or creator payouts.
- Avatar, virtual-world, or Life Simulator runtime.

The prototype is a useful interaction experiment, not yet the GALINYX OS architecture described above. Do not describe local browser storage as secure cloud memory or describe structured templates as AI generation.

## 6. Recommended build sequence

### Phase 0 — Product and technical foundation
- Keep this document as the product north-star.
- Map the existing repository and identify the actual deployable application.
- Separate product shell, domain model, data layer, and integration boundaries.
- Add automated checks for core flows and data import/export.
- Record architectural decisions and known limitations.

**Exit condition:** the team can explain what exists, how it works, and what must change without relying on assumptions.

### Phase 1 — Durable GALINYX Core
- Introduce a real account and workspace model.
- Persist projects, artifacts, tasks, and memory in a server-side database.
- Add authentication, authorization, data export, and deletion.
- Define shared IDs and versioned schemas for core primitives.
- Preserve mobile usability and graceful offline/read-only behavior where practical.

**Exit condition:** a user can sign in on another device and continue the same workspace with predictable permissions and recoverable data.

### Phase 2 — Intelligence Runtime
- Add a model-provider abstraction and a narrowly scoped inference service.
- Start with one useful workflow that reads approved project context and produces reviewable output.
- Add capability permissions, confirmation gates, provenance, logging, rate limits, and cost visibility.
- Evaluate quality and failure modes before adding additional agents.

**Exit condition:** at least one AI workflow is measurably useful, traceable, and safe to operate.

### Phase 3 — Developer and Creator Ecosystem
- Publish capability contracts and an SDK.
- Add developer registration, versioning, testing, and permission review.
- Introduce a discoverable catalog only after install, update, revoke, and support flows exist.
- Add monetization only with clear creator terms, payment operations, dispute handling, and transparent fees.

**Exit condition:** an independent creator can build, publish, maintain, and earn from a working capability under clear rules.

### Phase 4 — Life Simulator foundation
- Define identity/representation boundaries and avatar ownership.
- Prototype one small persistent environment and one user-controlled avatar.
- Establish asset formats, portability rules, permissions, moderation, and safety controls.
- Connect experiences to existing projects and creator capabilities through shared primitives.

**Exit condition:** a user can enter a persistent experience, control their representation, and use an owned asset without surrendering identity or asset control.

## 7. Immediate engineering priorities

1. Audit the current repository and deployment path; identify which branch is the active source of truth.
2. Add a clear project map and accurate setup/build instructions.
3. Move core data handling behind a versioned domain model before introducing cloud persistence.
4. Add tests for local persistence, export/import validation, and destructive actions.
5. Decide the first durable backend and authentication approach based on cost, portability, and maintainability.
6. Keep the first AI integration narrow; do not build a broad agent marketplace before the core is dependable.

## 8. Decision log

| Decision | Current position |
|---|---|
| Product scope | One connected AI-native operating ecosystem |
| Core control model | Human-directed; permissioned execution |
| AI architecture | Provider-agnostic abstraction preferred |
| Memory | Scoped, sourced, revisable, exportable |
| Creator economy | Long-term platform layer, not a substitute for core reliability |
| Life Simulator | Long-term layer built on shared identity, assets, permissions, and experiences |
| Current prototype | Local-first browser workspace; not yet a full OS or AI runtime |

## 9. What GALINYX must not become

- A generic chatbot with a new logo.
- A disconnected pile of tools with separate identities and data silos.
- An opaque agent that takes consequential actions without meaningful user control.
- A marketplace before developers and users have a reliable core platform.
- A virtual world that treats a person's avatar, identity, or generated likeness as platform property.
- A product whose marketing promises exceed its shipped capabilities.

**The build principle:** establish the shared foundation once, then let every new capability compound the value of the ecosystem.
