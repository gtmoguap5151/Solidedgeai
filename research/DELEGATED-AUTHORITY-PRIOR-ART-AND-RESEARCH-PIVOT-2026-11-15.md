# GALINYX — Delegated Authority Prior-Art Review and Research Pivot

**Review date:** 2026-11-15  
**Status:** Preliminary technical research; not a patentability, novelty, or freedom-to-operate opinion  
**Branch:** `galinyx-launch`  
**Decision:** Do not build a proprietary delegated-token format or claim that multi-hop authority attenuation is an unaddressed gap.

## 1. Executive finding

The initial GALINYX research hypothesis was that a protocol-neutral governance layer could preserve and verify end-to-end authority constraints across multi-hop agent tasks crossing A2A and MCP.

A focused review found directly overlapping work already in active IETF Internet-Drafts in 2026:

- **OAuth Delegation Chain** (draft-liu-oauth-chain-delegation-00, published 2026-06-06) states that RFC 8693's nested `act` claim identifies actors but does not itself record the authorization constraints applied at each hop. It proposes a `delegation_chain` claim to record delegation records and constraints.
- **Verifiable Attenuated Delegation for AI Agent Chains** (draft-asor-wimse-agent-delegation-chain-03, October 2026) proposes signed, linked delegation records, offline verification, monotonic attenuation, bounded depth, monotonic expiry, and principal invariance.
- **Attenuating Authorization Tokens for Agentic Delegation Chains** (draft-niyikiza-oauth-attenuating-agent-tokens-02, October 2026) proposes task-scoped tool and argument constraints with holder-derived narrower tokens and offline verification.

These are Internet-Drafts, not final standards or proof of deployed adoption. They nevertheless directly overlap the original proposed research question. A new GALINYX token format or a claim to have solved multi-hop agent authority attenuation would be poorly differentiated and could duplicate active standards work.

## 2. Standards and systems boundary

### A2A

The current A2A specification supports authentication and authorization integration and an `AUTH_REQUIRED` task state. It explicitly says A2A itself does not define the scope, representation, validity, or revocation semantics of the authorization credential returned in response. It also says the state transition alone is not authorization for a particular operation.

Implication: A2A leaves room for implementation profiles and integrations, but that room is not an empty field. The IETF drafts above directly target agent delegation semantics.

Reference: https://a2a-protocol.org/latest/specification/

### MCP

MCP's HTTP authorization model already uses OAuth-based protected-resource authorization, metadata discovery, token validation, audience restrictions, and scopes. It is a resource-server authorization model, not a complete cross-agent delegation policy language.

Implication: GALINYX must not claim to invent agent-to-tool authorization or token audience validation.

References:
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- https://blog.modelcontextprotocol.io/posts/2026-07-28/

### OAuth RFC 8693 and current delegation drafts

RFC 8693 defines delegation and impersonation semantics and the nested `act` actor claim. The current IETF drafts seek to add explicit per-hop constraints, chain binding, and attenuation rules.

Implication: GALINYX should interoperate with established OAuth token exchange and evaluate the emerging profiles. It should not create a competing token format without a compelling, evidenced reason.

References:
- https://www.rfc-editor.org/rfc/rfc8693
- https://datatracker.ietf.org/doc/html/draft-liu-oauth-chain-delegation-00
- https://datatracker.ietf.org/doc/html/draft-asor-wimse-agent-delegation-chain-03
- https://datatracker.ietf.org/doc/html/draft-niyikiza-oauth-attenuating-agent-tokens-02

### Policy engines

OPA and Cedar already provide general policy evaluation. Cedar models authorization around principal, action, resource, and context, and defaults to deny unless a permit policy applies. OPA provides policy decision and decision-log capabilities.

Implication: GALINYX must not claim to invent policy-as-code or a general-purpose authorization decision engine. Any candidate value must be in measurable interoperability, integration correctness, lifecycle handling, or evidence—not reimplementing these engines.

References:
- https://www.openpolicyagent.org/docs
- https://docs.cedarpolicy.com/auth/authorization.html

## 3. Research decision

**Rejected as a standalone differentiator:** “GALINYX invents secure multi-hop agent delegation with authority attenuation.”

Reason: multiple active IETF drafts directly propose that capability. They are not final standards, but their existence is enough to make a broad novelty claim unsound.

**Candidate pivot for investigation, not yet validated:** a protocol-neutral interoperability and conformance layer that tests whether deployed combinations of agent protocols, token profiles, and policy engines preserve the same authorization intent at every enforcement point.

This would not mint a new authority token or replace A2A, MCP, OAuth, OPA, or Cedar. It would:
1. consume established identity and delegation artifacts;
2. normalize only the policy facts needed for a decision without discarding source semantics;
3. evaluate whether each downstream operation remains within the root grant and every intermediate delegation;
4. detect semantic mismatches between protocol adapters and policy engines;
5. produce reproducible conformance evidence and traceable denial reasons.

This candidate must be compared against existing agent-security testing, OAuth conformance, policy testing, and integration observability products before it is treated as a defensible product or grant topic.

## 4. Proposed experiment

### Research question

Can a vendor-neutral conformance harness detect authorization-semantic drift when one delegated task is represented and enforced across A2A, MCP, and at least one established policy engine, without replacing their native identity or policy mechanisms?

### Test topology

- A human/root principal authorizes a bounded task.
- Agent A receives a task and delegates a narrower subtask to Agent B.
- Agent B invokes an MCP tool through a protected resource server.
- An authorization layer validates the applicable token/profile.
- A policy engine (OPA or Cedar) evaluates the operation.
- A conformance harness records the decision, the relevant policy facts, and the provenance needed to reproduce the result.

This is a test topology, not a claim that the current GALINYX prototype supports these integrations.

### Required test cases

1. **Scope widening:** a child delegation requests an action or resource not granted by its parent. Expected: deny.
2. **Argument widening:** a child may call a tool but attempts an argument outside the parent's permitted value/range. Expected: deny when the applicable profile expresses that constraint; otherwise report unsupported semantics and fail closed.
3. **Audience substitution:** a token issued for one resource is presented to another. Expected: reject.
4. **Principal substitution:** a downstream actor changes the accountable root principal. Expected: reject.
5. **Approval substitution:** approval for one action/resource/payload is replayed against a different action/resource/payload. Expected: reject.
6. **Expiry widening:** a child credential outlives the parent authority. Expected: reject.
7. **Revocation:** a revoked parent or child authorization is used again. Expected: reject according to the selected revocation/status mechanism; document propagation limits.
8. **Replay:** a previously consumed one-time authorization is reused. Expected: reject where one-time semantics are required.
9. **Protocol translation:** semantically equivalent A2A and MCP operations are translated through adapters. Expected: same allow/deny result and no broader effective permission.
10. **Unknown policy field/profile version:** a constraint cannot be understood by an adapter or policy engine. Expected: fail closed, not silently drop the field.
11. **Audit reconstruction:** an independent reviewer can reconstruct why an operation was allowed or denied from retained, integrity-protected evidence, without exposing secrets.
12. **Concurrency and race:** revocation or approval expiry occurs while a task is queued or executing. Expected: enforcement follows a documented linearization point and does not rely on stale authorization.

### Measurements

Do not invent target numbers before baseline measurement. Record:
- false-allow count (critical safety metric);
- false-deny count;
- semantic mismatches found per adapter pair;
- proportion of constraints preserved end-to-end;
- time to detect/reject revoked or expired authority;
- decision latency and throughput overhead;
- audit reconstruction completeness;
- reproducibility from a clean checkout.

A single false allow on a prohibited high-impact action is a failed safety result, not an average to hide in a performance chart.

### Baselines

Compare at least:
- native A2A + OAuth implementation without the proposed GALINYX harness;
- native MCP OAuth resource-server checks;
- one established policy engine (OPA or Cedar) used directly;
- the same topology with the proposed adapter/conformance layer.

The harness must not be allowed to claim credit for controls already provided by the underlying standards or policy engine.

## 5. Prototype boundary

The current GALINYX OS prototype is a local Python/SQLite runtime. It does not yet provide real user authentication, verified ownership, production multi-tenant isolation, external network endpoints, or A2A/MCP integrations.

Therefore, the experiment should initially be a separate, isolated research harness with synthetic identities and test services. It must not connect to live accounts, real payments, public posting, or production user data.

Do not merge experimental authorization code into the core runtime until the threat model, interfaces, and test evidence are reviewed.

## 6. Go/no-go gates

Proceed only if all are satisfied:

- A current competitor/product scan finds a concrete unmet need beyond the active IETF draft proposals.
- At least two prospective technical users confirm the integration/conformance problem is real and costly.
- The baseline demonstrates a repeatable mismatch or operational gap that existing standards and implementations do not already address.
- The proposed harness detects the issue without weakening native security controls.
- The test suite has zero false allows across the defined adversarial cases.
- The result can be reproduced from a clean checkout and independently reviewed.

Stop or change direction if mature products or implementations already provide equivalent cross-protocol conformance and evidence.

## 7. Funding implications

The original broad delegated-authority research pitch should not be submitted as written. The active IETF work materially weakens novelty claims.

A revised funding case may be possible only if the conformance/interoperability experiment demonstrates a distinct technical uncertainty and measurable result. A test harness by itself may be ordinary product engineering rather than fundable high-risk R&D; program fit must be established before drafting a Project Pitch.

No grant application, patent claim, certification claim, or customer promise should be based on this preliminary review.

## 8. Next actions

1. Review the full current text and change history of the three IETF drafts, including open issues and overlap between them.
2. Search existing agent-security testing, authorization conformance, policy testing, and observability products.
3. Interview prospective platform/security engineers about cross-protocol authorization drift.
4. Build only a synthetic proof-of-concept if a concrete baseline failure is found.
5. Update the funding brief only after the candidate pivot passes the go/no-go gates.

**Bottom line:** GALINYX should not compete by reinventing delegation tokens. The next defensible question is whether it can make existing agent authorization mechanisms work together consistently—and prove that they did.


## 9. Preliminary commercial landscape scan

A second search found that the proposed conformance/governance pivot also sits in an active product category. Public product descriptions are vendor claims and are not independent validation of efficacy, but they are sufficient to reject a claim that the category is empty.

- **Google Cloud Agent Gateway:** describes agent identity, ingress/egress governance, policy enforcement, and end-to-end observability across agent-to-agent and agent-to-MCP interactions. https://docs.cloud.google.com/gemini-enterprise-agent-platform/govern/gateways/agent-gateway-overview
- **Pomerium Agentic Access Management:** describes per-action authorization, contextual policy, MCP egress controls, credential handling, and end-to-end auditability. https://www.pomerium.com/agentic-access-management
- **Ory Agent Security:** describes agent identity, fine-grained authorization through Ory Keto, per-action decisions, revocation, and observability. https://www.ory.com/agent-security
- **Invaris Labs AgentSec / AgentAuth:** describes adversarial agent workflow testing, identity and delegated authority, scoped grants, and evidence dashboards. Its public material also points to open-source repositories. https://www.invarislabs.com/
- **Endram:** describes a gateway for MCP/HTTP/tool calls with identity, request-scoped policy, human approvals, one-use grants, and signed evidence. https://app.endram.com/
- **Themis Agent Intelligence:** describes runtime evaluation of consequential agent actions against delegated authority, provenance, and context. https://themislabs.ai/ai
- **Noma Agent Access Control:** describes discovery, governance, and enforcement for agents and MCP servers. https://noma.security/blog/noma-launches-agentic-access-control-to-govern-ai-agents-and-mcp-servers-across-the-enterprise
- **AWS sample agentic governance platform:** describes an open-source AWS-native control plane using Entra identities, Cedar policies, multi-MCP access, governance graph, and observability. https://github.com/aws-samples/sample-agentic-governance-platform

### Competitive conclusion

A generic "agent governance layer," "agent authorization gateway," "multi-agent audit trail," or "agent security testing platform" is not a defensible positioning statement by itself. Several products and projects already describe overlapping combinations of those capabilities.

The conformance-harness concept is also not automatically differentiated: Invaris AgentSec describes adversarial workflow tests and evidence, while major cloud and access vendors describe runtime enforcement and observability. A more specific unmet need must be evidenced.

### Revised decision

**No-go for building a generic agent governance gateway or proprietary delegation-token system as GALINYX's claimed differentiator.**

**Research-only continuation:** investigate whether there is a narrow, independently verifiable gap in cross-vendor conformance for the emerging IETF agent-delegation profiles—especially deterministic interoperability tests that vendors can run in CI against independent implementations. Do not assume this is novel. Search for existing conformance suites, implementations, reference test vectors, and vendor support first.

A viable contribution may ultimately be:
- an open test corpus/reference harness for a named, stable profile;
- an interoperability adapter with a demonstrated failure mode not solved by native products;
- or no standalone product at all, if the need is already covered.

The next decision must be based on evidence of adoption, implementation gaps, and buyer demand—not on the fact that the technology is new.


## 10. Direct inspection of the AIP reference implementation

**Repository inspected:** https://github.com/sunilp/aip  
**Repository default branch:** `master`  
**Repository state returned by GitHub API during this review:** public Apache-2.0 repository; 138 commits shown by the public repository page; Python and Rust implementations; tests under `tests/conformance`; repository last pushed 2026-10-10. These are repository metadata observations, not an independent quality assessment.

### What exists already

The reference project is materially more developed than a paper-only proposal:
- Python and Rust implementations.
- MCP middleware/proxy and A2A verification components described in the project README and IETF draft.
- Cross-language conformance tests for token interoperability and policy encoding.
- A dedicated test corpus under `tests/conformance`.
- A published Python package; PyPI records version 0.6.0 uploaded 2026-10-10.

Relevant source locations:
- https://github.com/sunilp/aip/tree/master/tests/conformance
- https://github.com/sunilp/aip/blob/master/tests/conformance/test_chained_interop.py
- https://github.com/sunilp/aip/blob/master/tests/conformance/test_interop.py
- https://github.com/sunilp/aip/blob/master/tests/conformance/test_policy_encoding.py
- https://pypi.org/project/agent-identity-protocol/0.6.0/

### What the existing tests demonstrate—and do not demonstrate

The conformance tests currently visible in the repository test:
- Rust-to-Python and Python-to-Rust token interoperability.
- Delegation blocks are present in chained-token tests.
- Scope dropped by a delegation is rejected in both languages.
- Python and Rust emit identical canonical Datalog for selected policy vectors.
- Certain forbidden policy encodings are not emitted.

These are useful tests. They are not an independent certification, and the test code is part of the same project as the implementations being tested.

The IETF draft itself makes a particularly important disclosure: during draft-01 development, Python and Rust passed cross-language tests while both failed requirements in the specification. It says implementers must test normative MUST requirements, including negative cases, rather than relying only on two implementations agreeing. This is direct evidence that interoperability tests alone can produce false confidence.

### Documented implementation gaps in draft -02

The current draft's implementation-status section reports:
- Neither known implementation provides the defined V7 revocation behavior.
- No independent implementation of the current revision was known to the author.
- The Rust implementation lacks the JWT chain encoding and domain support, and does not reject certain repeated single-valued facts or max-depth cases.
- Proof-of-possession support is partial in JWT mode and absent in the Biscuit encoding.
- The MCP middleware/proxy do not verify proof of possession.
- The draft's dual-axis authorization requirement is not met by AIP itself; combining agent authority with the principal's own entitlements remains the relying party's responsibility.
- The draft reports partial audit guarantees, including a JWT-chain truncation limitation without proof of possession.
- Earlier Python implementation versions had Datalog-injection authorization bypasses; the draft now requires strict rejection/parameter binding of unsafe values.

These are disclosures in a working Internet-Draft and must be treated as implementation-status claims by the draft author, not as findings from an independent penetration test of the current code. The draft also states that its implementation inventory may be incomplete.

### More precise opportunity

The broad conformance-harness concept is not empty: AIP already has conformance tests, and its draft explicitly discusses the difference between agreement and normative conformance.

A potentially useful research contribution would have to be more precise than "test AIP":
1. Independent, implementation-neutral test vectors derived directly from each normative MUST/SHOULD and security invariant.
2. Differential tests across independent implementations and encodings, not only the two implementations maintained in one repository.
3. Negative/adversarial tests for malformed Datalog inputs, chain truncation, missing holder proof, domain omission, principal substitution, depth/budget/expiry widening, revocation staleness, and unknown/unsupported fields.
4. Protocol-binding tests proving that the actual MCP and A2A enforcement paths bind the presented token to the exact request, tool, resource, audience, and actor.
5. Tests for fail-closed behavior when required security semantics are unsupported or unavailable.
6. Reproducible CI outputs that separate spec conformance, cross-implementation interoperability, security testing, and performance. Passing one category must never be presented as passing the others.

### Revised go/no-go

**Still no-go:** building a competing delegation protocol, generic agent security gateway, or generic conformance product based only on the current evidence.

**Proceed with bounded research only:** determine whether independent, implementation-neutral conformance artifacts for the emerging agent identity/delegation profiles are missing, desired by implementers, and technically distinct from existing project tests.

A suitable first deliverable, if the gap survives research, is a small public test-vector corpus and a runner that checks normative requirements against more than one implementation. It should be protocol/profile-specific and vendor-neutral, not branded as a universal agent-security certification.

No code has been copied from the AIP repository. No third-party tests have been executed in this review. No vulnerability has been independently reproduced. The current work is source/specification inspection only.

## 11. AIP -02 requirements-to-test coverage matrix

**Review date:** 2026-11-15  
**Reference specification:** [draft-prakash-aip-02](https://datatracker.ietf.org/doc/html/draft-prakash-aip-02), published 2026-10-10.  
**Reference implementation inspected:** default branch of [sunilp/aip](https://github.com/sunilp/aip), including the Python test files and the three files under `tests/conformance`.  
**Method:** source inspection only. The tests were not executed. “Not located” means not found in the files inspected; it is not a claim that no such test exists anywhere in the repository.

### Coverage legend

- **Observed:** a test directly exercises the stated behavior in an inspected file.
- **Partial:** some relevant cases exist, but important requirements, encodings, bindings, or negative cases are not covered by the inspected tests.
- **Not implemented / no test:** the specification or implementation-status disclosure says the behavior is not implemented.
- **Not established:** available source inspection does not support a reliable coverage conclusion.

### Normative verification algorithm

| Requirement | Evidence in inspected tests | Assessment |
|---|---|---|
| **V1 — chain integrity**: verify every signature from the root, verify serialized bytes, reject unverified fields | `python/tests/test_jwt_chain.py` tests wrong root key, tampered signature, `alg=none`, wrong `typ`, non-holder signing, parent-digest mismatch, and issuer continuity. `tests/conformance/test_chained_interop.py` exchanges delegated Biscuit tokens across Python/Rust. | **Partial.** Good JWT negative cases in Python; no JWT-chain cross-language test. The inspected Biscuit interop tests prove selected exchange cases, not the entire V1 requirement set. |
| **V2 — root binding**: bind root key to issuer identity and require relying-party trust policy | JWT tests reject a wrong supplied root key. The implementation-status section says the library takes a caller-supplied key and does not resolve identity documents over HTTPS; issuer-to-key comparison is limited to one proxy configuration mode. | **Partial.** Signature/key mismatch is tested; identity resolution and consistent issuer-to-key binding across all relying-party paths are not established. |
| **V3 — depth**: require root max_depth and reject a chain deeper than that bound | `python/tests/test_chain_model.py` tests depth exceeded and missing root max_depth. `python/tests/test_jwt_chain.py` tests depth exceeded and rejects max_depth on a delegation link. | **Observed in Python core tests; partial across implementations.** The draft says the Rust implementation does not reject max_depth in delegation blocks. |
| **V4 — structural attenuation**: tools, domains, budget, expiry, principal, and malformed/empty constraints | `python/tests/test_chain_model.py` tests wildcard semantics, tool/domain widening, budget increase/negative budget, expiry widening/expiry, principal substitution, empty allowlists, and required root fields. `python/tests/test_jwt_chain.py` includes forged JWT widening cases for tools, domains, budget, expiry, principal, and max_depth. | **Strong Python unit coverage; partial overall.** The cross-language conformance suite does not cover JWT chains or domains. The draft says Rust lacks domains and has additional malformed-chain gaps. |
| **V5 — delegation context**: every delegation context must be non-empty and not whitespace-only | `python/tests/test_chain_model.py` rejects empty and null context; `python/tests/test_jwt_chain.py` rejects empty context. | **Partial.** A whitespace-only context case was not located in the inspected files, although the draft explicitly requires rejection of whitespace-only values. |
| **V6 — request authorization**: authorize the requested tool/domain and evaluate Biscuit checks with only the permitted ambient facts | `python/tests/test_chain_model.py` tests tool and domain authorization. `python/tests/test_jwt_chain.py` tests permitted and denied tools. `python/tests/test_policy.py` and `tests/conformance/test_policy_encoding.py` test canonical Datalog output and that budget/depth are not emitted as checks. | **Partial.** Core checks are represented, but the draft says no binding supplies a request domain, so domain constraints are not enforced against actual requests. The inspected conformance suite does not test all binding-to-request semantics or every prohibited ambient-fact case end-to-end. |
| **V7 — revocation with bounded staleness**: verify signed revocation data and fail closed when cached data is too old | The draft explicitly says V7 is not implemented and its response format/freshness representation is unspecified. | **Not implemented; no conformance test possible yet.** This is a specification interoperability gap as well as an implementation gap. |

### Additional mandatory security properties and bindings

| Property | Evidence and status |
|---|---|
| **JWT holder-key / subject binding** (Section 4.8) | The draft and project changelog identify that the JWT verifier does not check whether each `cnf` key is bound to its `sub` identifier. The JWT tests validate `cnf` syntax and issuer continuity, but the specific key-to-identifier binding is not tested. **Not implemented / no test located.** |
| **Proof of possession (Section 8)** | `python/tests/test_jwt_chain.py` tests extraction of the leaf holder key and demonstrates that a prefix of a chain verifies as a shorter chain. That is a test of the truncation condition, not proof that the presenter possesses the leaf key. The draft says MCP middleware, proxy, and A2A verifier do not verify proof of possession. **Not implemented in the inspected enforcement paths.** |
| **JWT required claims** (`iat`, `jti`) | The JWT test checks that the minting function emits these claims. The draft says the verifier does not check that links carry them. **Mint-side presence is observed; verifier-side enforcement is not implemented.** |
| **Identity documents and key resolution** | `python/tests/test_identity.py` tests identifier parsing and resolution-URL construction. The draft says the library does not resolve identity documents over HTTPS; it also records limitations in JCS handling, unknown/null members, and key selection. **Partial parser coverage; resolution/signature semantics remain incomplete.** |
| **MCP request binding** | `python/tests/test_mcp_middleware.py` tests header extraction, token-mode detection, simple compact-token success/failure, missing tokens, and error formatting. The draft says the current proxy/middleware do not perform proof of possession and no binding supplies a request domain. **Partial; not end-to-end conformance for JWT chains, PoP, or domains.** |
| **A2A binding** | The draft describes an A2A verifier and records that it accepts both encodings, but the files inspected here did not include the complete A2A binding test suite. The draft also says the A2A verifier does not perform proof of possession. **Not established for full test coverage; PoP gap is documented.** |
| **Generic HTTP binding and token-by-reference** | The draft's implementation-status section says the HTTP Authorization binding and token-by-reference header are not implemented. **Not implemented.** |
| **Workload-attested anchor mode** | The draft says the mode is not implemented and that `aip_anchor` is carried but not checked. `test_jwt_chain.py` checks only that the anchor claim is serialized. **Claim transport observed; anchor validation not implemented.** |
| **Datalog injection resistance** | `CHANGELOG.md` describes earlier authorization bypasses and says string validation/parameter binding was added. The exact injection regression-test files were not located in this inspection. **Fix is documented by the project; independent reproduction and complete regression-test review remain outstanding.** |
| **Transport and SSRF requirements** | The draft requires HTTPS for identity resolution/token references and recommends URL-domain validation and timeouts. The relevant resolution and token-reference paths are not implemented according to the draft. **Not implemented / not testable in the current binding set.** |

### What the existing cross-language suite actually covers

The three inspected files under `tests/conformance` are:

- `test_chained_interop.py`: Python/Rust Biscuit delegation-token exchange and a selected scope-narrowing denial.
- `test_interop.py`: legacy draft-01 compact-token exchange.
- `test_policy_encoding.py`: selected Python/Rust Datalog-rendering vectors and checks against forbidden budget/depth check forms.

The first two files explicitly describe draft-01 behavior. The policy-encoding file also cites draft-01. The draft's own implementation-status section says the 26 cross-language tests do **not** cover the JWT chain encoding or domains. The current Python branch separately contains draft-02 unit tests in `python/tests/test_jwt_chain.py` and `python/tests/test_chain_model.py`, but those are not cross-language conformance tests.

**Conclusion:** the reference project has meaningful draft-02 Python unit tests. It would be inaccurate to say that AIP -02 has no tests. The narrower finding is that its inspected cross-language conformance suite remains centered on earlier formats and does not demonstrate cross-language conformance for the new JWT chain or domain semantics.

### Documentation/version discrepancy to resolve

The -02 draft's implementation-status text says the latest Python release is 0.5.0 and describes -02 code as being on a development branch. However:
- PyPI lists version 0.6.0, uploaded 2026-10-10, with provenance pointing to the `sunilp/aip` repository.
- The repository `CHANGELOG.md` labels 0.6.0 “Unreleased” while saying it accompanies draft -02.
- The same repository's README advertises 0.6.0 and reports 391 tests (311 Python and 80 Rust).

This may be a documentation/release synchronization issue rather than a code defect. Before making any conformance claim, the exact source commit, package artifact, test count, and draft revision need to be pinned together. The PyPI provenance is useful evidence of package origin, not evidence that the package conforms to the current draft.

## 12. Independent implementation and ecosystem check

### What was found

- The IETF draft explicitly states: “Two implementations are known, both by the author,” and that the author is not aware of independent implementations of this revision.
- The Python and Rust implementations are identified in the draft as the author's reference implementations.
- The linked TypeScript SDK is in the same `sunilp` GitHub account and describes itself as the AIP TypeScript SDK. It is another project implementation, not evidence of an independent implementer.
- The linked AIP gateway is also in the same `sunilp` account. It is an integration product built around the same protocol project, not an independent protocol implementation.
- PyPI provenance for `agent-identity-protocol` points to `github.com/sunilp/aip`.
- A separate repository named `unibaseio/aip-ts-sdk` describes the Unibase Agent Internet Protocol, a different protocol using the same acronym. It must not be counted as an implementation of draft-prakash-aip.

### Result

**No independently maintained implementation of draft-prakash-aip-02 was identified in this bounded search.** This agrees with the draft author's own implementation-status statement. The search does not prove that none exists; it means no qualifying independent implementation was verified.

A fork, SDK, gateway, or framework adapter maintained within the same project/account does not provide the independent implementation diversity needed for a meaningful differential conformance claim.

## 13. Engineering decision and next move

### What is now established

1. AIP -02 is an active individual Internet-Draft, not an IETF-approved standard.
2. The Python reference implementation contains meaningful -02 tests for the encoding-neutral chain model and JWT chain.
3. The three inspected cross-language conformance files do not cover the new JWT chain or domains.
4. The draft itself documents major unfinished controls: V7 revocation, proof of possession in enforcement paths, JWT key-to-identifier binding, and missing HTTP/token-reference/workload-attestation implementations.
5. No independent -02 implementation was verified.
6. The absence of independent implementations makes a differential conformance product difficult to validate commercially today.

### Go/no-go

**No-go for a commercial AIP conformance product at this stage.** There is no verified independent implementation base, no demonstrated buyer demand, and no evidence yet that the gaps are being paid to solve.

**Go for one bounded, open research artifact:** a specification-derived negative test-vector pack for the security-critical requirements that are not already adequately represented in the current tests. Initial candidate groups:
- JWT chain key-to-identifier binding and proof-of-possession/truncation behavior;
- V7 revocation semantics once the draft defines an interoperable response format;
- binding-level tests that prove the actual MCP/A2A request, tool, domain, and audience are the ones being authorized;
- Datalog injection and malformed-input regression vectors, after confirming they do not duplicate existing tests.

Do not claim these are vulnerabilities. They are test-coverage or implementation gaps until independently reproduced against a specific build.

### Immediate engineering sequence

1. Pin the exact AIP source commit and package artifact that correspond to draft -02.
2. Review the remaining Python security/regression tests and the complete MCP/A2A binding test suites, not just the files inspected in this pass.
3. Inspect the Rust source and tests at the same commit; determine whether the current -02 Python behavior has any Rust equivalent.
4. Build an independent test-vector pack only for requirements not already covered, with each vector linked to the exact normative paragraph and expected failure result.
5. Run the vectors against the reference implementation in an isolated, reproducible environment. Record every pass, failure, skip, and unsupported behavior.
6. Do not publish a vulnerability claim unless a failure is reproduced and responsibly disclosed.
7. Revisit commercial value only after an independent implementation or prospective buyer confirms the need.

### Funding impact

This is not yet a strong funding application. The best defensible description is a narrowly scoped research effort to produce independently reproducible conformance evidence for emerging agent-delegation profiles. It needs a sharper technical uncertainty, a pinned baseline, reproducible results, and prospective-user validation before it can support a serious R&D funding pitch.

**Bottom line:** we found a real distinction between unit coverage, cross-language interoperability, and independent conformance. The current AIP project has the first two in limited forms; independent implementation diversity is still missing. GALINYX should contribute evidence that can be independently checked—not another protocol, another gateway, or a certification badge without a validated test basis.
