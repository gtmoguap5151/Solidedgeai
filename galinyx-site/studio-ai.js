/**
 * studio-ai.js — Creator Studio AI generation (GALINYX OS, v1 Phase 3).
 *
 * The Studio calls the galinyx-ai Backend Worker; the Worker calls Gemini
 * with the API key held server-side. No key ever appears in this file, in
 * the shell, or in the repo.
 *
 * Wiring (see STUDIO_AI_PATCH.md): this file loads AFTER the shell's inline
 * script, so it can use the shell's globals (lastDraft, persist, log,
 * renderHome, data). Every use is guarded, so nothing throws if it is
 * loaded on its own.
 */

const STUDIO_AI_BASE = 'https://galinyx-ai.gtmoguap5151.workers.dev';
const STUDIO_AI_MAX_INPUT = 6000; // keep the built prompt under the Worker's 8,000-char cap

function studioAIGet(id) {
  return document.getElementById(id);
}

function studioAITruncate(text, max) {
  if (text.length <= max) return text;
  return text.slice(0, max) + '… [trimmed]';
}

function studioAIBuildPrompt(title, kind, idea, guard) {
  const label = {
    story: 'STORY PREMISE',
    character: 'CHARACTER OUTLINE',
    product: 'PROJECT BRIEF',
  }[kind] || 'PROJECT BRIEF';
  const questions =
    kind === 'story'
      ? 'What does the main character want most? What stands in the way? What changes if they fail? What choice drives the turning point?'
      : kind === 'character'
        ? 'Goal: what do they actively pursue? Motivation: why does it matter? Strength: what helps them? Flaw or tension: what complicates their choices? Arc: what could change?'
        : 'Who is this for? What problem does it solve? What is the smallest useful version? How will success be measured? What must be tested before launch?';
  return [
    'You are helping a creator expand a rough idea into a structured starting draft.',
    'Write the draft in this exact structure, in plain text, no markdown:',
    '',
    title.toUpperCase(),
    label,
    '',
    'CORE IDEA',
    idea,
    '',
    'ESTABLISHED DETAILS',
    'Expand the idea into concrete details. Use only what the creator provided or what follows directly from it — do not invent facts, names, or backstory.',
    '',
    'QUESTIONS TO ANSWER',
    questions,
    'Answer each question briefly from the idea above, or mark it OPEN if the idea does not say.',
    '',
    'CONSTRAINTS / CANON',
    guard || 'No constraints supplied yet.',
    'Respect every constraint above. If an idea conflicts with a constraint, the constraint wins.',
    '',
    'OPEN QUESTIONS',
    'List what is still unknown. Do not treat assumptions as verified facts.',
    '',
    'STATUS',
    'AI-assisted draft — review and revise. No external research was performed.',
  ].join('\n');
}

async function generateWithAI() {
  const titleEl = studioAIGet('project-title');
  const kindEl = studioAIGet('creator-type');
  const ideaEl = studioAIGet('project-idea');
  const guardEl = studioAIGet('project-constraints');
  const outputEl = studioAIGet('draft-output');
  const statusEl = studioAIGet('draft-status');
  const buttonEl = studioAIGet('btn-generate-ai');

  const title = (titleEl ? titleEl.value.trim() : '') || 'Untitled project';
  const kind = kindEl ? kindEl.value : 'product';
  const idea = ideaEl ? ideaEl.value.trim() : '';
  const guard = guardEl ? guardEl.value.trim() : '';

  if (!idea) {
    alert('Add your idea first.');
    return;
  }

  const prompt = studioAIBuildPrompt(
    title,
    kind,
    studioAITruncate(idea, STUDIO_AI_MAX_INPUT),
    studioAITruncate(guard, 2000)
  );

  const previousOutput = outputEl ? outputEl.textContent : '';
  if (outputEl) outputEl.textContent = 'Generating your draft…';
  if (statusEl) statusEl.textContent = 'Generating with AI…';
  if (buttonEl) buttonEl.disabled = true;

  try {
    // Sign-in gate: the Worker verifies the Supabase session token
    // before answering. No token -> the Worker returns 401 and the
    // error below tells Matt to sign in.
    const token = typeof sbAccessToken === 'function' ? await sbAccessToken() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(STUDIO_AI_BASE + '/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        typeof result.error === 'string' && result.error
          ? result.error
          : 'The AI service could not complete that request.'
      );
    }
    const text = typeof result.text === 'string' ? result.text : '';
    if (!text.trim()) throw new Error('The AI service returned an empty draft.');

    // Same landing as the local build: draft output + lastDraft, so Copy and
    // Save to Project Memory work unchanged. Shell globals are guarded so
    // this file degrades gracefully if loaded on its own.
    try { lastDraft = text; } catch (e) { /* shell not loaded */ }
    if (outputEl) outputEl.textContent = text;
    if (statusEl) statusEl.textContent = 'Draft generated with AI — review and revise.';
    try {
      if (Array.isArray(data.projects) && !data.projects.some((p) => p.title === title)) {
        data.projects.push({ id: Date.now(), title, kind, at: new Date().toISOString() });
        if (typeof persist === 'function') persist();
      }
    } catch (e) { /* shell store not loaded */ }
    if (typeof log === 'function') log('AI draft generated', title);
    if (typeof renderHome === 'function') renderHome();
  } catch (error) {
    // Failure keeps the previous draft on screen; only the status changes.
    if (outputEl) outputEl.textContent = previousOutput;
    if (statusEl) {
      statusEl.textContent =
        error && error.message ? error.message : 'The AI service could not complete that request.';
    }
  } finally {
    if (buttonEl) buttonEl.disabled = false;
  }
}

// On load, ask the Worker whether AI is configured and say so on the button.
// If the Worker is unreachable, the button stays as-is and the first click
// reports the problem — nothing here blocks the Studio from working.
async function initStudioAI() {
  const buttonEl = studioAIGet('btn-generate-ai');
  if (!buttonEl) return;
  try {
    const response = await fetch(STUDIO_AI_BASE + '/health', { method: 'GET' });
    if (!response.ok) return;
    const data = await response.json().catch(() => ({}));
    if (data && data.configured === false) {
      buttonEl.disabled = true;
      buttonEl.title = 'AI is not configured yet. The owner needs to set the API key.';
      buttonEl.textContent = 'AI not set up yet';
    }
  } catch {
    // Worker unreachable — leave the button alone; generateWithAI reports it.
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStudioAI);
} else {
  initStudioAI();
}
