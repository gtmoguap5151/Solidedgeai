import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");

const playbooks: Record<string, { title: string; filename: string; intro: string; sections: { h: string; bullets: string[] }[] }> = {
  starter_playbook: {
    title: 'Solid Edge AI Starter Playbook',
    filename: 'Solid-Edge-AI-Starter-Playbook.html',
    intro: 'A practical starting system for choosing AI work that produces measurable business value instead of adding more tools and noise.',
    sections: [
      { h: '1. Pick the first workflow', bullets: ['List repetitive tasks done at least weekly.', 'Circle tasks tied to revenue, speed, or customer experience.', 'Choose one task that takes 30+ minutes per week and has a clear before/after result.', 'Do not automate a broken process; simplify the process first.'] },
      { h: '2. Use the ROI filter', bullets: ['Money: can this help win, retain, upsell, or recover revenue?', 'Time: can this remove manual writing, research, follow-up, sorting, or scheduling?', 'Risk: does it reduce forgotten follow-ups, missed details, or inconsistent communication?', 'Keep only workflows that improve at least one of those three.'] },
      { h: '3. Build a reusable prompt', bullets: ['State the role: who the AI should act like.', 'Provide the business context and customer type.', 'Define the exact task and required output format.', 'Add constraints: tone, length, facts not to invent, and what needs human approval.', 'Save the prompt and improve it after real use.'] },
      { h: '4. Turn prompts into workflows', bullets: ['Trigger: what starts the work?', 'Input: what information must be provided?', 'AI step: what should be drafted, analyzed, or classified?', 'Human check: what must a person approve?', 'Action: what gets sent, saved, scheduled, or updated?', 'Metric: what number proves the workflow is useful?'] },
      { h: '5. Your 7-day launch plan', bullets: ['Day 1: choose one workflow.', 'Day 2: write the first reusable prompt.', 'Day 3: test it on three real examples.', 'Day 4: fix weak outputs and add constraints.', 'Day 5: document the exact steps.', 'Day 6: use it in real work.', 'Day 7: measure minutes saved or revenue influenced and decide whether to keep, improve, or kill it.'] },
      { h: '6. Scorecard', bullets: ['Weekly minutes saved', 'Leads or customers touched', 'Response time improvement', 'Revenue influenced', 'Errors or missed steps prevented', 'Keep a workflow only when the scorecard shows value.'] },
    ],
  },
  sales_marketing: {
    title: 'AI Sales & Marketing Playbook',
    filename: 'AI-Sales-Marketing-Playbook.html',
    intro: 'A repeatable system for turning AI into faster outreach, better follow-up, stronger offers, and more consistent customer communication.',
    sections: [
      { h: '1. Build the message bank', bullets: ['Create one clear ideal-customer profile.', 'Write the top 10 customer pains in the customer’s own language.', 'Create proof points: results, experience, guarantees, process advantages, and FAQs.', 'Turn these into reusable hooks, headlines, emails, texts, posts, and proposal language.'] },
      { h: '2. Lead-response system', bullets: ['Respond fast with a short acknowledgement.', 'Ask only the questions needed to qualify the opportunity.', 'Summarize the customer need before pitching.', 'Use AI to draft the next-best response, but keep pricing and promises under human control.', 'Set a next action and date for every live lead.'] },
      { h: '3. Follow-up sequence', bullets: ['Touch 1: answer the request and confirm the next step.', 'Touch 2: add useful information, proof, or a common question.', 'Touch 3: make the decision easy with a clear call to action.', 'Touch 4: address the most likely objection.', 'Touch 5: close the loop politely and leave the door open.', 'Reuse the structure while personalizing customer-specific details.'] },
      { h: '4. Content engine', bullets: ['Start from customer questions, job stories, objections, mistakes, comparisons, and before/after lessons.', 'Create one strong source idea each week.', 'Use AI to repurpose it into a post, short video outline, email, FAQ, and sales talking point.', 'Never publish generic filler just to hit a quota.'] },
      { h: '5. Offer improvement', bullets: ['Describe the outcome before the features.', 'Make the scope and process easy to understand.', 'Reduce uncertainty with proof, examples, and clear expectations.', 'Use bonuses only when they improve the result, not to inflate perceived value.', 'Test one variable at a time: headline, CTA, proof, pricing presentation, or follow-up timing.'] },
      { h: '6. Weekly growth dashboard', bullets: ['New leads', 'Lead response time', 'Follow-up completion rate', 'Appointments or calls booked', 'Proposals sent', 'Close rate', 'Revenue won', 'Source of each sale'] },
    ],
  },
  operations_automation: {
    title: 'AI Operations & Automation Playbook',
    filename: 'AI-Operations-Automation-Playbook.html',
    intro: 'A practical operating system for reducing admin friction, standardizing repetitive work, and building AI-assisted workflows that remain understandable and controllable.',
    sections: [
      { h: '1. Map the operation', bullets: ['Write down recurring workflows by department or responsibility.', 'For each workflow, record trigger, owner, inputs, steps, output, and failure points.', 'Mark steps that are repetitive, text-heavy, rules-based, or dependent on copying information between systems.', 'Those marked steps are the best AI/automation candidates.'] },
      { h: '2. Automation ladder', bullets: ['Level 1: AI drafts; a person does everything else.', 'Level 2: templates and saved prompts standardize the work.', 'Level 3: forms or structured inputs feed AI automatically.', 'Level 4: software moves data and triggers actions after approval.', 'Level 5: low-risk workflows run automatically with alerts and audit trails.', 'Move up only after the lower level is stable.'] },
      { h: '3. SOP builder', bullets: ['Purpose: why the process exists.', 'Trigger: what starts it.', 'Inputs: what information is required.', 'Steps: numbered actions with owners.', 'AI instructions: exact prompt or rule set.', 'Approval points: where a human must verify.', 'Exception handling: what happens when the normal path fails.', 'Metric: speed, quality, cost, or revenue target.'] },
      { h: '4. Admin workflows to attack first', bullets: ['Inbox triage and response drafting', 'Meeting or call summaries', 'Task extraction and handoff', 'Scheduling preparation', 'Document and proposal drafting', 'Internal status updates', 'Data cleanup and categorization', 'Recurring customer reminders'] },
      { h: '5. Reliability rules', bullets: ['Never let AI invent customer facts, prices, legal terms, or commitments.', 'Keep a human approval step on money, contracts, hiring, safety, and high-impact customer decisions.', 'Log important automated actions.', 'Maintain a manual fallback.', 'Review workflows monthly and remove automations that create more maintenance than value.'] },
      { h: '6. 30-day rollout', bullets: ['Week 1: map and rank workflows.', 'Week 2: standardize the top two with prompts and SOPs.', 'Week 3: automate inputs, routing, or handoffs.', 'Week 4: measure results and expand only the workflow that shows the strongest ROI.'] },
    ],
  },
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch] || ch));
}

function renderPlaybook(data: { title: string; intro: string; sections: { h: string; bullets: string[] }[] }) {
  const sections = data.sections.map((s) => `<section><h2>${escapeHtml(s.h)}</h2><ul>${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul></section>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(data.title)}</title><style>body{font-family:Arial,sans-serif;max-width:820px;margin:0 auto;padding:40px 24px;color:#1c1917;line-height:1.6}h1{font-size:34px;margin-bottom:8px}h2{margin-top:34px;font-size:22px}p{font-size:18px;color:#57534e}li{margin:8px 0}.brand{font-weight:700;color:#b45309;margin-bottom:28px}.note{margin-top:42px;padding:18px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px}@media print{body{padding:0}.note{break-inside:avoid}}</style></head><body><div class="brand">Solid Edge AI — AI that earns its place</div><h1>${escapeHtml(data.title)}</h1><p>${escapeHtml(data.intro)}</p>${sections}<div class="note"><strong>Use this playbook as a working document.</strong> Implement one workflow at a time, measure the result, and keep only what saves time, makes money, or makes the business easier to run.</div></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token) return new Response(JSON.stringify({ error: 'Download token is required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: claimed, error: claimError } = await supabase.rpc('claim_download', { p_token: token });
    if (claimError) throw claimError;
    const link = Array.isArray(claimed) ? claimed[0] : claimed;
    if (!link) return new Response(JSON.stringify({ error: 'Invalid, expired, or exhausted download link.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const releaseClaim = async () => {
      await supabase.from('download_links').update({ download_count: Math.max(0, link.download_count - 1) }).eq('id', link.id);
    };

    const { data: purchase, error: purchaseError } = await supabase.from('course_purchases').select('product_key').eq('id', link.purchase_id).maybeSingle();
    if (purchaseError || !purchase) {
      await releaseClaim();
      return new Response(JSON.stringify({ error: 'Purchase record not found.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const productKey = purchase.product_key || 'contractor_course';
    if (productKey === 'contractor_course') {
      const { data: signed, error: storageError } = await supabase.storage.from('course-pdfs').createSignedUrl('AI-Automation-for-Contractors-Complete-Course.zip', 60, { download: true });
      if (storageError || !signed) {
        await releaseClaim();
        return new Response(JSON.stringify({ error: 'Course files are temporarily unavailable.' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const fileResponse = await fetch(signed.signedUrl);
      if (!fileResponse.ok) {
        await releaseClaim();
        return new Response(JSON.stringify({ error: 'Failed to retrieve course files.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(await fileResponse.blob(), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="AI-Automation-for-Contractors-Complete-Course.zip"', 'X-Product-Key': productKey } });
    }

    const data = playbooks[productKey];
    if (!data) {
      await releaseClaim();
      return new Response(JSON.stringify({ error: 'Product delivery is not configured.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(renderPlaybook(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="${data.filename}"`, 'X-Product-Key': productKey, 'X-Download-Filename': data.filename } });
  } catch (err) {
    console.error('Download product error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong during delivery.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
