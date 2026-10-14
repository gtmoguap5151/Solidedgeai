/**
 * Cross-industry, free educational tools with no paid access claim.
 * Not individual legal, financial, medical, safety, or professional advice.
 * Designed to work without an online database.
 */
export const builtInResources = [
  {
    "id": "built-in-creator-brief",
    "resource_key": "solid_edge_creator-brief",
    "title": "Creator's Content Repurposing Studio",
    "description": "Turn a single original insight into channel-specific posts while keeping the voice, source, and claims intact.",
    "resource_type": "prompt_system",
    "capability_key": "instruction_design",
    "level": "builder",
    "professional_track": null,
    "content_text": "START WITH: One original idea, talk, article, or recording you own and have permission to reuse.\n\nPROMPT: Act as an editor for [audience]. Using only the source below, produce: (1) a 120-word LinkedIn post with one real takeaway; (2) a 30-second vertical video script with hook, main idea and ending; (3) a 5-slide carousel outline; (4) a short newsletter intro; (5) five relevant titles. Retain my tone: [three adjectives]. Do not invent testimonials, results, statistics, quotations, or personal stories. Mark anything that needs fact checking. Source: [paste your material].\n\nPUBLISHING WORKFLOW:\n1. Verify all specific facts against your original material.\n2. Remove repeated or overhyped hooks.\n3. Choose a useful question or action for the audience.\n4. Publish only where sharing is permitted.\n5. Track saves, replies, site visits and actual conversions—not vanity impressions alone.\n\nPRACTICE: Repurpose a 200-word original article. Pass when every format adds value, nothing is made up, and no copyrighted third-party content is reproduced without permission.",
    "version": "1.0",
    "last_reviewed_at": "2026-10-13"
  },
  {
    "id": "built-in-offer-design",
    "resource_key": "solid_edge_offer-design",
    "title": "Freelancer & Consultant Offer Builder",
    "description": "Turn a skill into a defined service with a customer problem, deliverables, limits and a fair price-testing plan.",
    "resource_type": "template",
    "capability_key": "workflow_design",
    "level": "builder",
    "professional_track": null,
    "content_text": "OFFER WORKSHEET\nCustomer: [specific buyer and situation]\nCostly problem: [observed, not assumed]\nOutcome within your control: [specific deliverable]\nWhat is included: [3-5 deliverables]\nWhat is excluded: [boundaries]\nInputs required from customer: [list]\nCompletion criteria: [observable handoff]\nTime and costs to fulfill: [your estimate]\nPrice hypothesis: [test, not guaranteed market rate]\nEvidence people want this: [real messages, signed orders, search requests]\nEthical next step: [one clear invitation]\n\nPROMPT: Evaluate the offer using only the above facts. Identify who should NOT buy, unclear deliverables, hidden labor, likely objections, fulfillment risks, and three ways to make the offer easier to understand. Write a 70-word description without promises of revenue, instant success or scarcity.\n\nVALIDATION: Speak with consenting potential buyers. Record inquiry → qualified conversation → proposal → paid sale. Do not count interest as revenue.\n\nPRACTICE: Draft an offer for an editor, event planner, bookkeeper, or web designer. Pass when a purchaser could explain exactly what they would receive.",
    "version": "1.0",
    "last_reviewed_at": "2026-10-13"
  },
  {
    "id": "built-in-ecommerce-audit",
    "resource_key": "solid_edge_ecommerce-audit",
    "title": "E-Commerce Listing & Conversion Audit",
    "description": "Improve product descriptions using verified facts and a practical storefront quality checklist.",
    "resource_type": "checklist",
    "capability_key": "verification",
    "level": "builder",
    "professional_track": null,
    "content_text": "INPUT: Product name, measured dimensions, materials, compatibility, verified photos, actual warranty, price, stock status, shipping/returns terms, and target use.\n\nPROMPT: Rewrite this product listing into: (1) one concise headline; (2) a plain-language first paragraph; (3) five factual bullets; (4) compatibility or sizing notes; (5) a 155-character search description; (6) five customer questions. Never invent product tests, reviews, stock, certifications, scarcity or performance numbers. Flag every claim lacking source evidence. Data: [paste verified product facts].\n\nLISTING AUDIT:\n[ ] Photos reflect the real product\n[ ] All dimensions have units\n[ ] Compatibility limitations are visible\n[ ] Returns and delivery conditions are accurate\n[ ] Benefits are tied to actual features\n[ ] No fake star ratings or endorsements\n[ ] Mobile layout makes the buy decision clear\n\nMEASUREMENT: Track visits, add-to-cart, checkout starts, completed orders and refunds before/after the change. Keep other variables stable when possible.\n\nPRACTICE: Improve a fictional notebook listing without adding any unsupported specifications.",
    "version": "1.0",
    "last_reviewed_at": "2026-10-13"
  },
  {
    "id": "built-in-career-kit",
    "resource_key": "solid_edge_career-kit",
    "title": "Job Seeker Resume & Interview Lab",
    "description": "Match real experience to a job description without exaggerating credentials or inventing achievements.",
    "resource_type": "prompt_system",
    "capability_key": "instruction_design",
    "level": "foundation",
    "professional_track": null,
    "content_text": "PROMPT: Act as a resume editor. Compare this job description with my verified work experience and skills. Return: (1) overlap; (2) genuine gaps; (3) a 4-line summary based on facts; (4) bullet rewrites only for roles and accomplishments I actually performed; (5) three interview questions with truthful answer outlines; (6) what I need to verify before applying. Never invent employment dates, degrees, certifications, metrics, employer names or accomplishments. Job: [paste public posting]. My experience: [paste non-sensitive facts].\n\nINTERVIEW PRACTICE:\nSituation: [specific task or difficulty]\nAction: [what you actually did]\nOutcome: [what you can support]\nWhat you'd improve: [honest reflection]\n\nFINAL REVIEW:\n- Every claim matches your work history\n- Nothing private is pasted unnecessarily\n- Applicant tracking keywords aren't stuffed dishonestly\n- Job requirements and licensing are verified\n- No applications are submitted without your approval\n\nPRACTICE: Tailor an example resume to a fictional customer-service role and identify one skill gap to learn.",
    "version": "1.0",
    "last_reviewed_at": "2026-10-13"
  },
  {
    "id": "built-in-research-audit",
    "resource_key": "solid_edge_research-audit",
    "title": "AI Research Verification & Decision Memo",
    "description": "A practical process for checking sources, separating facts from guesses and making decisions with evidence.",
    "resource_type": "workflow",
    "capability_key": "verification",
    "level": "foundation",
    "professional_track": null,
    "content_text": "QUESTION: [one decision]\nOPTIONS: [2-4 realistic choices]\nTIME HORIZON: [date]\nHARD CONSTRAINTS: [budget, safety, location]\n\nPROMPT: Produce a decision memo with a claim-by-claim verification table. Mark each assertion VERIFIED (with actual cited primary evidence), UNVERIFIED, INFERENCE, or OPINION. Identify missing data, contradictory sources and the consequence of being wrong. Do not invent URLs, studies, people, or regulatory requirements. If you cannot access sources, provide a checklist to verify manually instead.\n\nEVIDENCE CHECK:\n1. Prefer current official data for law, regulation and prices.\n2. Confirm date, jurisdiction, definitions and exceptions.\n3. Distinguish marketing claims from measured outcomes.\n4. Check whether the source has a financial incentive.\n5. Avoid placing sensitive personal information in AI prompts.\n\nFINAL MEMO: Best supported option; why; strongest alternative; three biggest unknowns; smallest reversible test; decision deadline.\n\nPRACTICE: Compare two fictional software subscriptions. Pass when unsourced claims are marked unknown and cost assumptions are visible.",
    "version": "1.0",
    "last_reviewed_at": "2026-10-13"
  },
  {
    "id": "built-in-office-sop",
    "resource_key": "solid_edge_office-sop",
    "title": "Universal Office Workflow & Automation Blueprint",
    "description": "Map any repeated process into an AI-assisted workflow with human review, failure handling and measurable outcomes.",
    "resource_type": "workflow",
    "capability_key": "automation_agents",
    "level": "advanced",
    "professional_track": null,
    "content_text": "WORKFLOW CARD\nProcess name: [ ]\nTeam / responsible person: [ ]\nTrigger: [ ]\nInputs & permissions: [ ]\nSteps currently performed: [ ]\nOutput and recipient: [ ]\nChecks and sign-off: [ ]\nWhat must never be automated: [ ]\nRecovery if AI fails: [ ]\nData retained / deleted: [ ]\nMinutes currently spent per case: [ ]\nVolume per week: [ ]\nKnown error rate: [ ]\n\nPROMPT: Convert this process into a standard operating procedure, showing each step, responsible owner, data input, output, approval, logging and error response. Suggest automation only where the downside is bounded. Require human review before sending financial, legal, medical, HR or customer-sensitive decisions. State software integrations as hypotheses until verified.\n\nVALUE TEST:\nRecord three manual baselines. Test three anonymized examples with AI. Measure editing time, errors, turnaround, customer outcomes and any new tool cost.\n\nPRACTICE: Map the intake and follow-up process for a fictional tutoring business. Pass when owners, checkpoints and a manual fallback are clear.",
    "version": "1.0",
    "last_reviewed_at": "2026-10-13"
  },
  {
    "id": "built-in-learning-path",
    "resource_key": "solid_edge_learning-path",
    "title": "Personal Learning Plan & Skill-Proof Portfolio",
    "description": "Build a seven-day study plan based on an actual deliverable, rather than collecting more tutorials.",
    "resource_type": "exercise",
    "capability_key": "workflow_design",
    "level": "foundation",
    "professional_track": null,
    "content_text": "SKILL TO LEARN: [ ]\nWHY IT MATTERS TO YOU: [ ]\nEXISTING KNOWLEDGE: [ ]\nAVAILABLE TIME PER DAY: [ ]\nONE PROOF PROJECT: [deliverable]\nPASSING STANDARD: [how a real person checks it]\n\nPROMPT: Act as a patient skills coach. Generate a seven-day plan for the target skill, with one 15- to 45-minute exercise per day, a worked example, two common mistakes, and a final practical demonstration. Do not claim the learner is certified. Explain what must be checked by a qualified human where safety or licensing matters. Begin at the stated level.\n\nDAY 1: Baseline task and known gaps.\nDAY 2: Learn one key concept.\nDAY 3: Repeat with feedback.\nDAY 4: Complete a realistic project segment.\nDAY 5: Debug or revise.\nDAY 6: Produce the deliverable.\nDAY 7: Present evidence against the rubric and plan the next step.\n\nEVIDENCE LOG: Date; task; output; independent feedback; revised output; remaining weakness.\n\nPRACTICE: Apply this to spreadsheet formulas, video editing, a language, or interview skills.",
    "version": "1.0",
    "last_reviewed_at": "2026-10-13"
  },
  {
    "id": "built-in-nonprofit-outreach",
    "resource_key": "solid_edge_nonprofit-outreach",
    "title": "Community Organization Outreach & Grant Readiness Kit",
    "description": "Create a factual one-page mission brief, contact plan and document checklist without inventing grant eligibility.",
    "resource_type": "template",
    "capability_key": "instruction_design",
    "level": "builder",
    "professional_track": null,
    "content_text": "ONE-PAGE BRIEF\nOrganization: [ ]\nMission: [ ]\nWho is served: [ ]\nVerified outcomes to date: [ ]\nCurrent need: [ ]\nProgram to be funded: [ ]\nRequested amount or in-kind support: [ ]\nHow funds would be used: [ ]\nEvidence/documentation on hand: [ ]\nContact and legitimate website: [ ]\n\nPROMPT: Rewrite this into a clear community support request and create a grant-readiness checklist. Do not invent nonprofit status, tax deductibility, partnerships, audited outcomes, grant requirements, or government endorsement. Show facts missing from the source materials. Tailor the tone to [audience], and include a respectful way to decline.\n\nREADINESS CHECK:\nLegal entity and tax status independently confirmed; budget; delivery capacity; program evidence; eligible expenses; reporting ability; privacy of beneficiaries; verifiable deadline; appropriate authorization to apply.\n\nPRACTICE: Create a fictional neighborhood literacy project brief, labeling all made-up sample data as examples rather than real achievements.",
    "version": "1.0",
    "last_reviewed_at": "2026-10-13"
  },
  {
    "id": "built-in-household-admin",
    "resource_key": "solid_edge_household-admin",
    "title": "Personal Paperwork & Life Admin Organizer",
    "description": "Keep deadlines, documents, subscriptions and household decisions organized without sharing sensitive records.",
    "resource_type": "checklist",
    "capability_key": "safety_privacy",
    "level": "foundation",
    "professional_track": null,
    "content_text": "PRIVATE DOCUMENT INDEX\nDocument category | Where YOU store it | Last reviewed | Renewal/deadline | Next action\nInsurance | [location only] | [ ] | [ ] | [ ]\nHousing | [location only] | [ ] | [ ] | [ ]\nVehicle | [location only] | [ ] | [ ] | [ ]\nWork/education | [location only] | [ ] | [ ] | [ ]\nSubscriptions | [provider names only] | [ ] | [ ] | [ ]\n\nPROMPT: Using this redacted list of deadlines and obligations, create a weekly administrative checklist ordered by consequences and due dates. Highlight missing information, duplicate tasks and decisions that require a human. Do NOT invent renewal dates, cancel subscriptions, send messages, or request account numbers, passwords, IDs or medical details.\n\nMAINTENANCE: Ten-minute weekly review; thirty-minute monthly deadline review; confirm details on the provider's official site; delete outdated copies securely.\n\nPRACTICE: Create a fictional household renewal list with five dates. Pass when no private identifiers are required and every deadline is preserved exactly.",
    "version": "1.0",
    "last_reviewed_at": "2026-10-13"
  },
  {
    "id": "built-in-property-ops",
    "resource_key": "solid_edge_property-ops",
    "title": "Property & Facility Maintenance Planner",
    "description": "Organize recurring inspection and repair tasks into owner-approved schedules without making safety or code claims.",
    "resource_type": "workflow",
    "capability_key": "workflow_design",
    "level": "professional",
    "professional_track": "property-management",
    "content_text": "ASSET REGISTER\nSite/asset: [ ]\nResponsible party: [ ]\nLast service and source: [ ]\nObserved condition: [ ]\nKnown manufacturer schedule: [ ]\nContractor/vendor required: [ ]\nNext review date: [ ]\nBudget approval owner: [ ]\nProof of work: [ ]\n\nPROMPT: Organize the supplied maintenance notes into (1) recurring checklist, (2) work-order list, (3) urgent items to have a qualified human assess, (4) parts or vendor questions, and (5) document gaps. Never invent service dates, permits, inspection findings, warranty coverage, or regulatory compliance. Do not treat AI output as professional inspection advice.\n\nWORK-ORDER TEMPLATE:\nLocation; issue; source of report; impact; photos available; priority proposed (not certified); required onsite assessment; vendor assignment; authorization; cost approval; completed work; documented verification.\n\nPRACTICE: Make a plan for a fictional six-unit apartment building and flag two items that need qualified review.",
    "version": "1.0",
    "last_reviewed_at": "2026-10-13"
  }
];
