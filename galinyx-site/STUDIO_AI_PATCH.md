# STUDIO_AI_PATCH.md — Wire Creator Studio to the galinyx-ai Worker

Apply AFTER the identity-display agent finishes editing `index.html`
(another agent is editing that file right now — do not apply this patch
while that work is in flight). The client file `studio-ai.js` already
exists in this same folder; this patch only wires it in.

## 1. Script tag (required)

Location: end of `index.html`, line 414. The file ends:

```html
</script></body></html>
```

Change it to:

```html
</script><script src="./studio-ai.js"></script></body></html>
```

The tag MUST come after the inline `</script>` — `studio-ai.js` uses the
shell's globals (`lastDraft`, `persist`, `log`, `renderHome`, `data`),
which only exist after the inline script has run.

## 2. Generate button (required)

Location: Creator Studio panel, line 45. Find this exact string:

```html
<button class="btn" onclick="makeDraft()">Build structured draft</button>
```

Add the AI button immediately after it (same line, same panel):

```html
<button class="btn" onclick="makeDraft()">Build structured draft</button><button class="btn secondary" id="btn-generate-ai" onclick="generateWithAI()">Generate with AI</button>
```

The `id="btn-generate-ai"` is required — `studio-ai.js` uses it for the
generating state and for the "AI not set up yet" check on load.

## 3. Home callout (required)

Location: line 33. Find:

```html
AI generation, external publishing, and autonomous execution are not connected.
```

Replace with:

```html
AI generation is connected through the GALINYX AI Worker. External publishing and autonomous execution are not connected.
```

## 4. Footer (required)

Location: line 109. Find:

```html
<span>Local-first · Account sync available · AI not connected</span>
```

Replace with:

```html
<span>Local-first · Account sync available · AI connected</span>
```

## 5. Service worker cache (required)

File: `sw.js` (same folder). Two changes:

- Add `"./studio-ai.js"` to the `SHELL_FILES` array (after `"./index.html"`).
- Bump `CACHE_NAME` from `"galinyx-os-shell-v6"` to `"galinyx-os-shell-v7"`.

Without this, installed copies of the app may never fetch the new file.

## 6. Studio callout (optional)

Location: line 44. The Studio callout reads: "This tool organizes the
details you provide into a structured draft. It does not perform external
research or verify facts." You may append this sentence:

```html
Generate with AI sends your idea to the GALINYX AI Worker; the key stays server-side.
```

## Verify after applying

1. `node --check` is not needed for HTML, but open the page and confirm:
   the Studio shows both buttons ("Build structured draft" and
   "Generate with AI").
2. With the Worker live and the key set: type an idea, click Generate
   with AI — the status shows "Generating with AI…", then the draft
   appears and the status reads "Draft generated with AI — review and
   revise." Copy and Save to Project Memory work on the AI draft.
3. With the Worker live but the key NOT set: the button reads
   "AI not set up yet" and is disabled.
4. With the Worker unreachable: clicking Generate shows a plain error in
   the status line and keeps the previous draft on screen.
