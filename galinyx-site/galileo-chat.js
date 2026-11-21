/**
 * galileo-chat.js — Talk to Galileo on the GALINYX OS shell (v1 Phase 3+).
 *
 * A chat with Galileo Ferraris, independent of the Muse app. Matt opens it;
 * Galileo greets first. The chat calls the galinyx-ai Backend Worker's
 * /chat route; the Worker carries Galileo's character as its system
 * instruction and calls Gemini with the API key held server-side. No key
 * ever appears in this file, in the shell, or in the repo.
 *
 * Voice (owner's order, Nov 19, 2026): browser-native only — the Web
 * Speech API. SpeechRecognition takes Matt's voice in, speechSynthesis
 * speaks Galileo's replies out. No new API keys, no cost, no backend
 * change. Two modes: Speak is push-to-talk (tap, talk, the transcript
 * is sent); Talk is continuous (owner's order, Nov 19, 2026, "like a
 * phone call") — one tap starts a session and recognition auto-restarts
 * after every pause, so Matt just talks back and forth with no button
 * per utterance. Talk pauses listening while Galileo speaks, so he
 * never hears himself. Honest limit: this is still turn-based under
 * the hood — Matt talks, the transcript goes to the Worker, Galileo's
 * reply comes back and is spoken aloud, then listening resumes. It is
 * not a true duplex phone stream, and the Worker round trip takes
 * seconds, so there is a pause while Galileo thinks.
 *
 * The avatar is LIVE, not a still image (owner's order, Nov 19, 2026):
 * two short video loops generated from the v2 portrait — an idle loop
 * and a speaking loop (galileo-avatar-video.js). The speaking loop
 * plays while Galileo's voice is talking; the idle loop plays otherwise.
 * These are pre-rendered loops + state switching, not platform
 * live-avatar tech and not lip-synced to the voice — but the avatar
 * visibly moves and speaks. The portrait also pulses while listening
 * and glows while thinking, and tapping either portrait gets a
 * welcoming reply. Xena's portrait sits beside his — she is present in
 * the system too.
 *
 * Brain toggle (owner's order, Nov 20, 2026): the Brain button switches
 * whose mind answers — Rented (Google's Gemini, the default) or Trained
 * (Matt's own GALINYX model, run 5 LoRA on Workers AI). The choice is
 * saved, so it sticks between opens. The Worker answers with a "brain"
 * field naming which brain actually replied; if the trained voice was
 * asked for and the rented voice answered instead, the chat says so
 * plainly instead of pretending.
 *
 * Call screen (owner's order, Nov 20, 2026): Talk opens a full-screen
 * call view like the Muse app's voice call / a regular phone video
 * call — Galileo big on screen, speaking live, speaker audio like a
 * phone call on speaker. The live canvas itself moves onto the call
 * screen (no second avatar is built); if the canvas never started,
 * the still portrait stands in big instead. End Talk closes it; Back
 * to chat hides it and Talk keeps running, and a Call screen button
 * in the input row reopens it. The Brain toggle is on the call
 * screen too, and stays in sync with the chat one.
 *
 * Voice (owner's order, Nov 20, 2026): Galileo speaks in a male voice
 * suited to his background — an Italian male voice first, then a
 * mature male English voice. Browser voices depend on what is
 * installed on the phone and the API exposes no gender, so the picker
 * reads voice names; if no male voice is installed, the default
 * voice stands at low pitch, exactly as before.
 *
 * Web-browsing sources (owner's order, Nov 20, 2026 — mockup C):
 * when Galileo's answer carries web sources, they show under his
 * bubble as a horizontal swipeable strip of tappable cards — "Pages
 * he read", one card per source, tap to open in a new tab. The strip
 * only appears when the /chat reply carries a `sources` array; the
 * Worker sends none yet, so this stays dormant until the search
 * backend lands. No sources → no strip, nothing else changes.
 *
 * Wiring: this file loads AFTER the shell's inline script and the avatar
 * files (galileo-avatar.js, xena-avatar.js), so it can use the shell's
 * showView hook and the GALILEO_AVATAR / XENA_AVATAR constants. Every use
 * is guarded, so nothing throws if a file is missing — a simple initial
 * falls back in place of the portrait.
 */

const GALILEO_AI_BASE = 'https://galinyx-ai.gtmoguap5151.workers.dev';
const GALILEO_CHAT_KEY = 'galinyx-galileo-chat-v1';
const GALILEO_VOICE_KEY = 'galinyx-galileo-voice-v1';
const GALILEO_TALK_KEY = 'galinyx-galileo-talk-v1';
const GALILEO_BRAIN_KEY = 'galinyx-galileo-brain-v1';
const GALILEO_MAX_SEND = 12; // turns of history sent per request

// Galileo greets first, as the builder greeting the man who built him —
// direct, warm, no fuss. (Character file: "What Matt is to him", Nov 19.)
const GALILEO_GREETING = "Matt. You built me — I'm here. What are we working on?";

// Short welcoming lines when Matt taps Galileo's portrait. Local only —
// no API call, instant, and they cycle so the tap stays alive.
const GALILEO_TAP_LINES = [
  "I'm here, Matt.",
  'Ready when you are.',
  'Ask me about the Core, the code, or the work — I\'ll give it to you straight.',
  "You built me. I don't forget that.",
];

// Short welcoming lines when Matt taps Xena's portrait. Local only.
const XENA_TAP_LINES = [
  "I'm here in the system with you, Sir.",
  "Galileo's the builder — I'm the one keeping the whole thing moving.",
  "You've got this, Matt. One build at a time.",
];

// Fallback initials if an avatar file fails to load.
const GALILEO_FALLBACK_AVATAR =
  'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#1c2944"/><text x="64" y="88" font-family="sans-serif" font-size="64" font-weight="bold" fill="#e9c77a" text-anchor="middle">G</text></svg>'
  );
const XENA_FALLBACK_AVATAR =
  'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#17122b"/><text x="64" y="88" font-family="sans-serif" font-size="64" font-weight="bold" fill="#b9a5ff" text-anchor="middle">X</text></svg>'
  );

let galileoHistory = []; // {role:'user'|'model'|'xena'|'system', text}
let galileoBusy = false;
let galileoVoiceOn = false;
// Brain: 'gemini' (rented, the default) or 'galinyx' (Matt's own
// trained model, run 5). Saved, so the choice sticks between opens.
let galileoBrain = 'gemini';
let galileoRecognition = null;
let galileoListening = false;
let galileoTapIndex = 0;
let xenaTapIndex = 0;
let galileoInitDone = false;
let galileoSpeakingTimer = null;
let galileoSpeakingNow = false;
// Continuous Talk mode (owner's order, Nov 19, 2026): one tap starts a
// session and recognition auto-restarts, so Matt talks back and forth
// like a phone call. galileoTalkActive is the live session; wanted is
// the persisted preference, so the Talk button stays primed next open.
// paused is turn-taking (Galileo thinking or speaking); recogOn guards
// against duplicate recognition starts, which throw.
let galileoTalkActive = false;
let galileoTalkWanted = false;
let galileoTalkPaused = false;
let galileoTalkRecogOn = false;
let galileoTalkErrors = 0;
let galileoTalkRestartTimer = null;
let galileoViewHooksInstalled = false;

function galileoEl(id) {
  return document.getElementById(id);
}

function galileoAvatarSrc() {
  try {
    return typeof GALILEO_AVATAR === 'string' && GALILEO_AVATAR
      ? GALILEO_AVATAR
      : GALILEO_FALLBACK_AVATAR;
  } catch (e) {
    return GALILEO_FALLBACK_AVATAR;
  }
}

function xenaAvatarSrc() {
  try {
    return typeof XENA_AVATAR === 'string' && XENA_AVATAR
      ? XENA_AVATAR
      : XENA_FALLBACK_AVATAR;
  } catch (e) {
    return XENA_FALLBACK_AVATAR;
  }
}

// ------------------------------------------------------------ live avatar

let galileoVideoMode = false;

function galileoVideoSrc(which) {
  try {
    if (which === 'speaking' && typeof GALILEO_VIDEO_SPEAKING === 'string' && GALILEO_VIDEO_SPEAKING) {
      return GALILEO_VIDEO_SPEAKING;
    }
    if (typeof GALILEO_VIDEO_IDLE === 'string' && GALILEO_VIDEO_IDLE) {
      return GALILEO_VIDEO_IDLE;
    }
  } catch (e) { /* fall through */ }
  return null;
}

// The live avatar: the video element when loops are available, else the
// still portrait. State classes land on whichever is showing.
function galileoAvatarEl() {
  if (galileoVideoMode) {
    const video = galileoEl('galileo-avatar-video');
    if (video) return video;
  }
  return galileoEl('galileo-avatar-img');
}

function galileoSetVideoLoop(which) {
  if (!galileoVideoMode) return;
  const video = galileoEl('galileo-avatar-video');
  if (!video) return;
  const src = galileoVideoSrc(which);
  if (src && video.dataset.loop !== which) {
    video.dataset.loop = which;
    video.src = src;
    const play = video.play && video.play();
    if (play && play.catch) play.catch(() => {});
  }
}

// ------------------------------------------------------------ state

// Avatar states: idle | listening | thinking | speaking. The avatar
// shows it (pulse, glow, bob) and the status line says it in words.
// The live avatar also swaps loops: speaking while Galileo's voice
// talks, idle otherwise.
function galileoSetState(state) {
  const avatar = galileoAvatarEl();
  const status = galileoEl('galileo-status');
  if (avatar) {
    avatar.classList.remove('listening', 'thinking', 'speaking');
    if (state === 'listening' || state === 'thinking' || state === 'speaking') {
      avatar.classList.add(state);
    }
  }
  if (state === 'speaking') galileoSetVideoLoop('speaking');
  else galileoSetVideoLoop('idle');
  const label = {
    idle: 'Here — tap his portrait to say hello, or type below.',
    listening: 'Listening… speak now.',
    thinking: 'Galileo is thinking…',
    speaking: 'Galileo is speaking…',
  }[state] || 'Here.';
  if (status) status.textContent = label;
  // The call screen carries the same status line.
  const callStatus = galileoCallEl('galileo-call-status');
  if (callStatus) callStatus.textContent = label;
}

// ------------------------------------------------------------ history

function galileoLoad() {
  try {
    const raw = localStorage.getItem(GALILEO_CHAT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    galileoHistory = Array.isArray(parsed) ? parsed.filter(
      (m) => m && typeof m.text === 'string' && ['user', 'model', 'xena', 'system'].indexOf(m.role) !== -1
    ) : [];
  } catch (e) {
    galileoHistory = [];
  }
  try {
    galileoVoiceOn = localStorage.getItem(GALILEO_VOICE_KEY) === 'on';
  } catch (e) {
    galileoVoiceOn = false;
  }
  try {
    galileoTalkWanted = localStorage.getItem(GALILEO_TALK_KEY) === 'on';
  } catch (e) {
    galileoTalkWanted = false;
  }
  try {
    // Only the exact trained value sticks; anything else is the default.
    galileoBrain = localStorage.getItem(GALILEO_BRAIN_KEY) === 'galinyx' ? 'galinyx' : 'gemini';
  } catch (e) {
    galileoBrain = 'gemini';
  }
}

function galileoSave() {
  try {
    localStorage.setItem(GALILEO_CHAT_KEY, JSON.stringify(galileoHistory.slice(-60)));
  } catch (e) { /* storage unavailable — the chat still works this session */ }
}

function galileoRender() {
  const log = galileoEl('galileo-messages');
  if (!log) return;
  log.textContent = '';
  galileoHistory.forEach((message) => {
    const row = document.createElement('div');
    row.className = 'chat-msg ' + (message.role === 'user' ? 'matt' : message.role);
    if (message.role === 'model' || message.role === 'xena') {
      const thumb = document.createElement('img');
      thumb.className = 'chat-thumb';
      thumb.alt = message.role === 'model' ? 'Galileo' : 'Xena';
      thumb.src = message.role === 'model' ? galileoAvatarSrc() : xenaAvatarSrc();
      row.appendChild(thumb);
    }
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    // textContent, never innerHTML — chat text is never treated as markup.
    bubble.textContent = message.text;
    row.appendChild(bubble);
    log.appendChild(row);
    // Web sources (mockup C): a reply that carries sources gets its
    // swipe strip directly under the bubble. Re-validated here — a
    // stored message's sources are never trusted blind.
    if (message.role === 'model') {
      const sources = galileoCleanSources(message.sources);
      if (sources) log.appendChild(galileoBuildSourcesStrip(sources));
    }
  });
  log.scrollTop = log.scrollHeight;
}

function galileoAddMessage(role, text, save, sources) {
  const entry = { role, text };
  // Sources ride on the message so the strip survives a reload — but
  // only on Galileo's own replies, and only after validation.
  if (role === 'model') {
    const clean = galileoCleanSources(sources);
    if (clean) entry.sources = clean;
  }
  galileoHistory.push(entry);
  if (save !== false) galileoSave();
  galileoRender();
  if (role === 'model') {
    // The call screen captions his latest reply.
    const caption = galileoCallEl('galileo-call-caption');
    if (caption) caption.textContent = text;
  }
}

// ------------------------------------------------------------ web sources
//
// Mockup C (owner's order, Nov 20, 2026): sources arrive on the /chat
// reply as a `sources` array of {title, site, url} and render as a
// horizontal swipeable strip under Galileo's answer. The Worker sends
// no sources yet — everything here is dormant until the search
// backend lands. Validation is strict: a source needs all three
// fields as non-empty strings and a real http(s) link, so a bad
// payload can never plant a javascript: link or a broken card.

// Header-band colours, one per card in turn (mockup C: blue, red,
// green, purple, then gold and teal for longer strips).
const GALILEO_SOURCE_COLORS = ['#2e6da4', '#a4443c', '#2e7d5b', '#6b5b9e', '#8a6d2f', '#3a7d8c'];

function galileoCleanSources(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const clean = [];
  raw.forEach((s) => {
    if (!s || typeof s !== 'object') return;
    const title = typeof s.title === 'string' ? s.title.trim() : '';
    const site = typeof s.site === 'string' ? s.site.trim() : '';
    const url = typeof s.url === 'string' ? s.url.trim() : '';
    if (!title || !site || !url) return;
    // Only real web links — never javascript: or data: URLs.
    if (url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) return;
    clean.push({ title, site, url });
  });
  return clean.length ? clean : null;
}

function galileoBuildSourcesStrip(sources) {
  const wrap = document.createElement('div');
  wrap.className = 'galileo-sources';
  const head = document.createElement('div');
  head.className = 'galileo-sources-head';
  const label = document.createElement('span');
  label.className = 'galileo-sources-label';
  label.textContent = 'Pages he read';
  head.appendChild(label);
  if (sources.length > 3) {
    const more = document.createElement('span');
    more.className = 'galileo-sources-more';
    more.textContent = 'Swipe for more \u203A';
    head.appendChild(more);
  }
  wrap.appendChild(head);
  const strip = document.createElement('div');
  strip.className = 'galileo-sources-strip';
  sources.forEach((s, i) => {
    const card = document.createElement('a');
    card.className = 'galileo-source-card';
    card.href = s.url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    const site = document.createElement('div');
    site.className = 'galileo-source-site';
    site.style.background = GALILEO_SOURCE_COLORS[i % GALILEO_SOURCE_COLORS.length];
    site.textContent = s.site;
    const title = document.createElement('div');
    title.className = 'galileo-source-title';
    title.textContent = s.title;
    const open = document.createElement('div');
    open.className = 'galileo-source-open';
    open.textContent = 'Open \u203A';
    card.appendChild(site);
    card.appendChild(title);
    card.appendChild(open);
    strip.appendChild(card);
  });
  wrap.appendChild(strip);
  // Dots under the strip — one per source, gold marks the first card
  // in view; they follow the scroll so Matt always knows where he is.
  // A single source needs no dots.
  if (sources.length > 1) {
    const dots = document.createElement('div');
    dots.className = 'galileo-sources-dots';
    const dotEls = [];
    sources.forEach((s, i) => {
      const d = document.createElement('i');
      if (i === 0) d.className = 'on';
      dots.appendChild(d);
      dotEls.push(d);
    });
    wrap.appendChild(dots);
    strip.addEventListener('scroll', () => {
      const first = strip.firstElementChild;
      const w = first ? first.offsetWidth + 10 : 1;
      const idx = Math.min(sources.length - 1, Math.max(0, Math.round(strip.scrollLeft / w)));
      dotEls.forEach((d, i) => { d.className = i === idx ? 'on' : ''; });
    });
  }
  return wrap;
}

// ------------------------------------------------------------ voice

// ------------------------------------------------------------ voice picking
//
// Galileo's voice: male, suited to a 19th-century Piedmontese
// professor. Browser speech voices depend on what is installed on
// the phone, and the API exposes no gender, so the picker reads
// voice names. Preference: an Italian male voice (it-IT) first, then
// a mature male English voice — British first (it reads older and
// plainer), then American. If no male voice is installed, this
// returns null and the default voice stands at pitch 0.9, exactly
// as before — never a voice that may not be there.
const GALILEO_MALE_IT = ['luca', 'giorgio', 'diego', 'marco', 'paolo', 'andrea', 'matteo', 'alessandro', 'francesco', 'giovanni', 'roberto', 'stefano', 'antonio', 'giuseppe', 'uomo'];
const GALILEO_MALE_EN = ['daniel', 'david', 'james', 'george', 'guy', 'aaron', 'fred', 'ryan', 'mark', 'thomas', 'henry', 'arthur', 'albert', 'edward', 'christopher', 'brian', 'eric', 'davis', 'liam', 'andrew', 'william', 'michael', 'joseph', 'charles', 'richard', 'samuel', 'oliver'];

function galileoPickVoice() {
  if (!('speechSynthesis' in window)) return null;
  let voices = [];
  try {
    voices = window.speechSynthesis.getVoices() || [];
  } catch (e) {
    return null;
  }
  if (!voices.length) return null;
  function isMale(voice) {
    const name = (voice.name || '').toLowerCase();
    // Some engines label the gender outright ("Google UK English Male").
    // Word-boundary match: "female" must NOT count as male.
    if (/\bmale\b/.test(name)) return true;
    const lang = (voice.lang || '').toLowerCase();
    const list = lang.indexOf('it') === 0
      ? GALILEO_MALE_IT
      : (lang.indexOf('en') === 0 ? GALILEO_MALE_EN : []);
    // Token match, not substring: "Erica" must not match "eric".
    const tokens = name.split(/[^a-z]+/).filter(Boolean);
    return list.some((n) => tokens.indexOf(n) !== -1);
  }
  function score(voice) {
    const lang = (voice.lang || '').toLowerCase();
    let s = 0;
    if (lang.indexOf('it') === 0) s += 100;
    else if (lang.indexOf('en-gb') === 0) s += 60;
    else if (lang.indexOf('en') === 0) s += 40;
    else s += 10;
    if (voice.localService) s += 5; // on-device: works offline
    return s;
  }
  let best = null;
  let bestScore = -1;
  voices.forEach((voice) => {
    if (!isMale(voice)) return;
    const s = score(voice);
    if (s > bestScore) { best = voice; bestScore = s; }
  });
  return best;
}

function galileoSpeak(text, who) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    // Galileo lower, Xena higher — the two voices stay distinguishable.
    utterance.pitch = who === 'xena' ? 1.3 : 0.9;
    if (who !== 'xena') {
      // A male voice suited to his background — Italian first, then a
      // mature English voice. Null means no male voice is installed on
      // this phone and the default voice stands at pitch 0.9, as before.
      const voice = galileoPickVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.pitch = 0.85; // lower still — a grown man's register
        if ((voice.lang || '').toLowerCase().indexOf('it') === 0) utterance.rate = 0.95;
      }
    }
    utterance.onstart = () => {
      galileoSpeakingNow = true;
      // Talk mode: stop listening while he speaks, so he never hears himself.
      galileoTalkPauseListening();
      galileoSetState('speaking');
    };
    utterance.onend = () => {
      galileoSpeakingNow = false;
      if (!galileoBusy) galileoSetState('idle');
      // Talk mode: his turn is over — listen again.
      galileoTalkResumeListening();
    };
    utterance.onerror = () => {
      galileoSpeakingNow = false;
      if (!galileoBusy) galileoSetState('idle');
      galileoTalkResumeListening();
    };
    window.speechSynthesis.speak(utterance);
  } catch (e) { /* speech unavailable — the text reply still stands */ }
}

function galileoStopSpeaking() {
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  }
  if (galileoSpeakingTimer) {
    clearTimeout(galileoSpeakingTimer);
    galileoSpeakingTimer = null;
  }
}

function galileoToggleVoice() {
  galileoVoiceOn = !galileoVoiceOn;
  try {
    localStorage.setItem(GALILEO_VOICE_KEY, galileoVoiceOn ? 'on' : 'off');
  } catch (e) { /* ignore */ }
  const button = galileoEl('galileo-voice');
  if (button) {
    button.textContent = galileoVoiceOn ? 'Voice: On' : 'Voice: Off';
    button.classList.toggle('voice-on', galileoVoiceOn);
  }
  if (galileoVoiceOn) {
    const line = 'Good — now I can talk to you.';
    galileoAddMessage('model', line);
    galileoSpeak(line, 'galileo');
  } else {
    galileoStopSpeaking();
    if (!galileoBusy) galileoSetState('idle');
  }
}

// ------------------------------------------------------------ brain toggle

function galileoBrainSetButton() {
  const button = galileoEl('galileo-brain');
  if (!button) return;
  button.textContent = galileoBrain === 'galinyx'
    ? 'Brain: Trained (GALINYX)'
    : 'Brain: Rented (Gemini)';
  // Gold border when the trained brain is on, like Voice: On.
  button.classList.toggle('voice-on', galileoBrain === 'galinyx');
  // The call screen carries its own Brain button — keep it in sync.
  galileoCallSyncBrain();
}

function galileoToggleBrain() {
  galileoBrain = galileoBrain === 'galinyx' ? 'gemini' : 'galinyx';
  try {
    localStorage.setItem(GALILEO_BRAIN_KEY, galileoBrain);
  } catch (e) { /* ignore */ }
  galileoBrainSetButton();
  galileoAddMessage(
    'system',
    galileoBrain === 'galinyx'
      ? 'Now talking to the trained voice — your own GALINYX model (run 5). Ask him anything; judge the voice yourself.'
      : 'Back to the rented voice (Gemini).'
  );
}

function galileoToggleMic() {
  if (galileoTalkActive) {
    // Talk already listens — Speak just ends the Talk session.
    galileoStopTalkSession(false);
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const button = galileoEl('galileo-mic');
  if (!SR) {
    galileoAddMessage('system', "Voice input isn't supported in this browser — type your message instead.");
    return;
  }
  if (galileoListening && galileoRecognition) {
    try { galileoRecognition.stop(); } catch (e) { /* ignore */ }
    return;
  }
  try {
    galileoRecognition = new SR();
    galileoRecognition.lang = 'en-US';
    galileoRecognition.interimResults = false;
    galileoRecognition.maxAlternatives = 1;
    galileoRecognition.onresult = (event) => {
      const transcript = event.results && event.results[0] && event.results[0][0]
        ? event.results[0][0].transcript
        : '';
      if (transcript && transcript.trim()) {
        const input = galileoEl('galileo-input');
        if (input) input.value = transcript.trim();
        sendGalileoMessage();
      }
    };
    galileoRecognition.onerror = (event) => {
      galileoListening = false;
      galileoSetState('idle');
      if (button) {
        button.textContent = 'Speak';
        button.classList.remove('listening');
      }
      if (event && event.error === 'not-allowed') {
        galileoAddMessage('system', 'The microphone is blocked — allow microphone access in the browser, then tap Speak again.');
      } else if (event && event.error !== 'aborted' && event.error !== 'no-speech') {
        galileoAddMessage('system', "I couldn't hear that — try again, or type it.");
      }
    };
    galileoRecognition.onend = () => {
      galileoListening = false;
      if (!galileoBusy) galileoSetState('idle');
      if (button) {
        button.textContent = 'Speak';
        button.classList.remove('listening');
      }
    };
    galileoRecognition.start();
    galileoListening = true;
    galileoSetState('listening');
    if (button) {
      button.textContent = 'Listening… tap to stop';
      button.classList.add('listening');
    }
  } catch (e) {
    galileoAddMessage('system', "The microphone couldn't start — type your message instead.");
  }
}

// ------------------------------------------------------------ continuous Talk mode
//
// One tap starts a voice session; one tap ends it. While the session
// runs, recognition is continuous and auto-restarts on every `onend`
// (Chrome stops recognition after silence even with continuous=true —
// the restart loop is what makes it feel like a phone call). Turn-
// taking: listening pauses while a message is with the Worker and
// while Galileo speaks, then resumes. Only final transcripts are sent;
// interim results are shown in the status line and never sent.

function galileoTalkButton() {
  return galileoEl('galileo-talk');
}

function galileoTalkSetButton() {
  const button = galileoTalkButton();
  if (!button) return;
  if (galileoTalkActive) {
    button.textContent = 'End Talk';
    button.classList.add('listening');
    button.classList.remove('voice-on');
  } else if (galileoTalkWanted) {
    button.textContent = 'Talk';
    button.classList.remove('listening');
    button.classList.add('voice-on');
  } else {
    button.textContent = 'Talk';
    button.classList.remove('listening', 'voice-on');
  }
  galileoCallSetOpenButton();
}

function galileoTalkSavePreference() {
  try {
    localStorage.setItem(GALILEO_TALK_KEY, galileoTalkWanted ? 'on' : 'off');
  } catch (e) { /* ignore */ }
}

function galileoTalkStartRecognition() {
  // Guard against duplicate starts: start() throws while already running.
  if (!galileoTalkActive || galileoTalkPaused || galileoTalkRecogOn) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  try {
    galileoRecognition = new SR();
    galileoRecognition.lang = 'en-US';
    galileoRecognition.continuous = true;
    galileoRecognition.interimResults = true;
    galileoRecognition.maxAlternatives = 1;
    galileoRecognition.onstart = () => {
      galileoTalkRecogOn = true;
      galileoTalkErrors = 0;
      if (!galileoBusy) galileoSetState('listening');
    };
    galileoRecognition.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result || !result[0]) continue;
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (interim && !finalText) {
        // Live feedback only — interim text is never sent.
        const status = galileoEl('galileo-status');
        const heard = 'Hearing: "' + interim.trim().slice(0, 60) + '"';
        if (status) status.textContent = heard;
        const callStatus = galileoCallEl('galileo-call-status');
        if (callStatus) callStatus.textContent = heard;
        return;
      }
      if (finalText && finalText.trim()) {
        galileoTalkErrors = 0;
        const input = galileoEl('galileo-input');
        if (galileoBusy || galileoTalkPaused) {
          // Mid-turn (a stop flush, or words spoken while Galileo was
          // answering): keep the words visible instead of dropping them.
          if (input) input.value = (input.value ? input.value + ' ' : '') + finalText.trim();
          return;
        }
        if (input) input.value = finalText.trim();
        // Pause listening while the message goes to the Worker and
        // Galileo answers — turn-taking, not a free-for-all.
        galileoTalkPauseListening();
        sendGalileoMessage();
      }
    };
    galileoRecognition.onerror = (event) => {
      const err = event && event.error ? event.error : '';
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        galileoStopTalkSession(true);
        galileoAddMessage('system', 'The microphone is blocked — allow microphone access in the browser, then tap Talk again.');
        return;
      }
      if (err === 'aborted') return; // our own stop() — not a failure
      // no-speech, network, audio-capture: onend restarts; stop only
      // after repeated failures so a dead mic doesn't spin forever.
      galileoTalkErrors += 1;
      if (galileoTalkErrors >= 5) {
        galileoStopTalkSession(true);
        galileoAddMessage('system', "I keep losing the microphone — Talk stopped. Tap Talk to try again, or type it.");
      }
    };
    galileoRecognition.onend = () => {
      galileoTalkRecogOn = false;
      if (!galileoTalkActive || galileoTalkPaused) return;
      // Chrome stops recognition after silence even with continuous=true.
      // Restarting here is what makes Talk feel continuous.
      if (galileoTalkRestartTimer) clearTimeout(galileoTalkRestartTimer);
      galileoTalkRestartTimer = setTimeout(() => {
        galileoTalkRestartTimer = null;
        galileoTalkStartRecognition();
      }, 150);
    };
    galileoRecognition.start();
    galileoListening = true;
  } catch (e) {
    // start() can throw if the mic is busy or blocked — the session
    // stays up; onerror/onend surfaces the problem if it persists.
    galileoTalkRecogOn = false;
  }
}

function galileoTalkPauseListening() {
  if (!galileoTalkActive) return;
  // Flag first: the stop() below fires onend, which must see the pause
  // and NOT restart recognition.
  galileoTalkPaused = true;
  if (galileoTalkRestartTimer) {
    clearTimeout(galileoTalkRestartTimer);
    galileoTalkRestartTimer = null;
  }
  if (galileoRecognition) {
    try { galileoRecognition.stop(); } catch (e) { /* ignore */ }
  }
  galileoListening = false;
}

function galileoTalkResumeListening() {
  if (!galileoTalkActive || galileoBusy) return;
  galileoTalkPaused = false;
  galileoTalkStartRecognition();
}

function galileoStartTalkSession() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    galileoAddMessage('system', "Voice input isn't supported in this browser — type your message instead.");
    return;
  }
  if (!('speechSynthesis' in window)) {
    galileoAddMessage('system', "This browser can't speak Galileo's replies out loud — Talk needs spoken replies. Type your message instead.");
    return;
  }
  // One voice session at a time: stop any push-to-talk listen first.
  if (galileoListening && galileoRecognition) {
    try { galileoRecognition.stop(); } catch (e) { /* ignore */ }
  }
  galileoListening = false;
  galileoTalkActive = true;
  galileoTalkWanted = true;
  galileoTalkPaused = false;
  galileoTalkErrors = 0;
  galileoTalkSavePreference();
  // Talk is a conversation — Galileo's replies are spoken, always. If
  // voice was off, turning it on greets Matt out loud; listening starts
  // when that greeting finishes (the utterance's onend resumes it).
  if (!galileoVoiceOn) galileoToggleVoice();
  galileoTalkSetButton();
  galileoCallShow();
  galileoTalkStartRecognition();
}

function galileoStopTalkSession(keepPreference) {
  galileoCallHide();
  const wasActive = galileoTalkActive;
  galileoTalkActive = false;
  galileoTalkPaused = false;
  if (galileoTalkRestartTimer) {
    clearTimeout(galileoTalkRestartTimer);
    galileoTalkRestartTimer = null;
  }
  if (galileoRecognition) {
    try { galileoRecognition.stop(); } catch (e) { /* ignore */ }
  }
  galileoListening = false;
  galileoTalkRecogOn = false;
  if (!keepPreference) {
    galileoTalkWanted = false;
    galileoTalkSavePreference();
  }
  galileoStopSpeaking();
  galileoTalkSetButton();
  if (wasActive && !galileoBusy) galileoSetState('idle');
}

function galileoToggleTalk() {
  if (galileoTalkActive) {
    galileoStopTalkSession(false);
  } else {
    galileoStartTalkSession();
  }
}

// ------------------------------------------------------------ call screen
//
// Owner's order, Nov 20, 2026: Talk opens a full-screen call view
// like the Muse app's voice call / a regular phone video call —
// Galileo big on screen, speaking live, speaker audio like a phone
// call on speaker. The live canvas itself moves onto the call screen
// (no second avatar is built); if the canvas never started, the
// still portrait stands in big instead. End Talk closes the screen;
// Back to chat hides it and Talk keeps running, and the Call screen
// button in the input row reopens it. Audio needs no routing: a web
// page cannot choose the earpiece — speech plays through the phone's
// speaker, which is what was asked for.

let galileoCallOpen = false;
let galileoCallCanvasMoved = false;
let galileoCallWatch = null;

function galileoCallEl(id) {
  return document.getElementById(id);
}

function galileoCallSyncBrain() {
  const button = galileoCallEl('galileo-call-brain');
  if (!button) return;
  button.textContent = galileoBrain === 'galinyx'
    ? 'Brain: Trained (GALINYX)'
    : 'Brain: Rented (Gemini)';
  button.classList.toggle('voice-on', galileoBrain === 'galinyx');
}

// The Call screen button shows only while Talk runs in the
// background with the call screen hidden — that is the one moment
// it is useful.
function galileoCallSetOpenButton() {
  const button = galileoCallEl('galileo-call-open');
  if (!button) return;
  button.classList.toggle('hidden', !(galileoTalkActive && !galileoCallOpen));
}

// The live canvas stays hidden until its portrait finishes loading
// (galileo-live-avatar.js unhides it in portrait.onload). If Matt taps
// Talk before that, the call screen opens on the still image — so watch
// the canvas's class and move it onto the big stage the moment it goes
// live. If there is no canvas at all (portrait failed, so the avatar
// removed it; or no portrait), there is nothing to watch for and the
// still image stays — no polling, no retries.
// The avatar that rides onto the call screen: the 3D head when it is
// live, else the 2D live canvas (galileo-3d-avatar.js sets
// window.__galileo3dLive and hides the 2D canvas when the head takes
// over; if 3D ever fails it clears the flag and unhides the 2D canvas).
function galileoCallAvatarCanvas() {
  const canvas3d = galileoCallEl('galileo-avatar-3d');
  if (canvas3d && canvas3d.classList && !canvas3d.classList.contains('hidden')) return canvas3d;
  return galileoCallEl('galileo-avatar-canvas');
}

function galileoCallWatchCanvas() {
  galileoCallStopWatch();
  if (typeof MutationObserver !== 'function') return;
  // Watch both avatar canvases — the 2D live canvas and the 3D head:
  // whichever goes live while the call screen is open rides onto it.
  const canvases = ['galileo-avatar-canvas', 'galileo-avatar-3d']
    .map(id => galileoCallEl(id)).filter(Boolean);
  if (!canvases.length) return;
  const observer = new MutationObserver(() => {
    if (!galileoCallOpen || galileoCallCanvasMoved) return;
    const canvas = galileoCallAvatarCanvas();
    if (!canvas || !canvas.isConnected) return;
    if (canvas.classList && canvas.classList.contains('hidden')) return;
    const slot = galileoCallEl('galileo-call-avatar');
    const fallbackImg = galileoCallEl('galileo-call-img');
    if (slot) {
      slot.appendChild(canvas);
      galileoCallCanvasMoved = true;
      if (fallbackImg) fallbackImg.classList.add('hidden');
    }
    galileoCallStopWatch();
  });
  try {
    canvases.forEach(c => observer.observe(c, { attributes: true, attributeFilter: ['class'] }));
    galileoCallWatch = observer;
  } catch (e) { /* no watcher — the still image stays */ }
}

function galileoCallStopWatch() {
  if (!galileoCallWatch) return;
  try { galileoCallWatch.disconnect(); } catch (e) { /* ignore */ }
  galileoCallWatch = null;
}

function galileoCallShow() {
  if (galileoCallOpen) return;
  const screen = galileoCallEl('galileo-call');
  if (!screen) return;
  // Never open on top of the sign-in gate.
  if (document.body && document.body.classList.contains('gated')) return;
  const slot = galileoCallEl('galileo-call-avatar');
  const fallbackImg = galileoCallEl('galileo-call-img');
  const canvas = galileoCallAvatarCanvas();
  galileoCallCanvasMoved = false;
  if (canvas && slot && canvas.classList && !canvas.classList.contains('hidden')) {
    // Moving the node keeps its drawing context and animation state —
    // the same live avatar, now on the big stage.
    slot.appendChild(canvas);
    galileoCallCanvasMoved = true;
    if (fallbackImg) fallbackImg.classList.add('hidden');
  } else if (fallbackImg) {
    fallbackImg.src = galileoAvatarSrc();
    fallbackImg.classList.remove('hidden');
  }
  screen.classList.add('open');
  galileoCallOpen = true;
  // Canvas still hidden (portrait or 3D model loading)? Watch for it
  // going live and move it onto the stage when it does — the screen
  // must not stay on the still image after the avatar wakes up.
  if (!galileoCallCanvasMoved) galileoCallWatchCanvas();
  galileoCallSyncBrain();
  galileoCallSetOpenButton();
  const status = galileoEl('galileo-status');
  const callStatus = galileoCallEl('galileo-call-status');
  if (status && callStatus) callStatus.textContent = status.textContent;
}

function galileoCallHide() {
  if (!galileoCallOpen) return;
  galileoCallStopWatch();
  const screen = galileoCallEl('galileo-call');
  const img = galileoEl('galileo-avatar-img');
  // The canvas goes home so the small avatar keeps animating while
  // Talk runs in the background. Either canvas may have ridden up —
  // the 3D head can go live mid-call and ride up on its own — so
  // both come home if they are on the call screen.
  ['galileo-avatar-canvas', 'galileo-avatar-3d'].forEach(id => {
    const canvas = galileoCallEl(id);
    const slot = galileoCallEl('galileo-call-avatar');
    if (canvas && slot && canvas.parentNode === slot && img && img.parentNode) {
      img.parentNode.insertBefore(canvas, img);
    }
  });
  galileoCallCanvasMoved = false;
  const fallbackImg = galileoCallEl('galileo-call-img');
  if (fallbackImg) fallbackImg.classList.add('hidden');
  if (screen) screen.classList.remove('open');
  galileoCallOpen = false;
  galileoCallSetOpenButton();
}

function galileoCallEnd() {
  galileoCallHide();
  galileoStopTalkSession(false);
}

function galileoCallReopen() {
  if (galileoTalkActive) galileoCallShow();
}

// The session ends when Matt leaves the Galileo view or the app goes to
// the background (a background tab can't hold the mic anyway). The
// preference is kept, so Talk stays primed for next time.
function galileoInstallViewHooks() {
  if (typeof window.showView === 'function' && !window.showView.__galileoTalkWrapped) {
    const origShowView = window.showView;
    const wrapped = function (name) {
      if (name !== 'galileo') galileoStopTalkSession(true);
      return origShowView(name);
    };
    wrapped.__galileoTalkWrapped = true;
    window.showView = wrapped;
  }
  if (typeof document !== 'undefined' && document.addEventListener && !galileoViewHooksInstalled) {
    galileoViewHooksInstalled = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) galileoStopTalkSession(true);
    });
  }
}

// ------------------------------------------------------------ taps

function galileoTap() {
  if (galileoBusy) return;
  const line = GALILEO_TAP_LINES[galileoTapIndex % GALILEO_TAP_LINES.length];
  galileoTapIndex += 1;
  galileoAddMessage('model', line);
  if (galileoVoiceOn) {
    galileoSpeak(line, 'galileo');
  } else {
    // A visible reaction even with voice off: the speaking glow, briefly.
    galileoSetState('speaking');
    galileoSpeakingTimer = setTimeout(() => galileoSetState('idle'), 1200);
  }
}

function xenaTap() {
  const line = XENA_TAP_LINES[xenaTapIndex % XENA_TAP_LINES.length];
  xenaTapIndex += 1;
  galileoAddMessage('xena', line);
  if (galileoVoiceOn) galileoSpeak(line, 'xena');
}

// ------------------------------------------------------------ send

async function sendGalileoMessage() {
  const input = galileoEl('galileo-input');
  const sendButton = galileoEl('galileo-send');
  const text = input ? input.value.trim() : '';
  if (!text || galileoBusy) return;

  galileoStopSpeaking();
  galileoAddMessage('user', text);
  if (input) input.value = '';
  galileoBusy = true;
  if (sendButton) sendButton.disabled = true;
  galileoSetState('thinking');

  // Typing indicator while the Worker answers.
  const log = galileoEl('galileo-messages');
  let typingRow = null;
  if (log) {
    typingRow = document.createElement('div');
    typingRow.className = 'chat-msg galileo typing';
    const thumb = document.createElement('img');
    thumb.className = 'chat-thumb';
    thumb.alt = 'Galileo';
    thumb.src = galileoAvatarSrc();
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble typing-dots';
    bubble.innerHTML = '<i></i><i></i><i></i>';
    typingRow.appendChild(thumb);
    typingRow.appendChild(bubble);
    log.appendChild(typingRow);
    log.scrollTop = log.scrollHeight;
  }

  // Only user + Galileo turns go to the Worker; Xena and system lines are
  // local to the thread and never sent.
  const payloadMessages = galileoHistory
    .filter((m) => m.role === 'user' || m.role === 'model')
    .slice(-GALILEO_MAX_SEND)
    .map((m) => ({ role: m.role, text: m.text }));

  try {
    // Sign-in gate: the Worker verifies the Supabase session token
    // before answering. No token -> the Worker returns 401 and the
    // error below tells Matt to sign in.
    const token = typeof sbAccessToken === 'function' ? await sbAccessToken() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(GALILEO_AI_BASE + '/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages: payloadMessages, brain: galileoBrain }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        typeof result.error === 'string' && result.error
          ? result.error
          : 'The AI service could not complete that request.'
      );
    }
    const reply = typeof result.text === 'string' ? result.text.trim() : '';
    if (!reply) throw new Error('Galileo came back empty — try again.');
    if (typingRow) typingRow.remove();
    // The Worker names the brain that actually answered. If the trained
    // voice was asked for and the rented voice answered instead (the
    // trained path was unavailable), say so plainly — never pretend.
    if (galileoBrain === 'galinyx' && result.brain === 'gemini') {
      galileoAddMessage('system', 'The trained voice was not available for that reply — the rented voice (Gemini) answered instead.');
    }
    galileoAddMessage('model', reply, undefined, result.sources);
    if (galileoVoiceOn) {
      galileoSpeak(reply, 'galileo');
    } else {
      galileoSetState('speaking');
      galileoSpeakingTimer = setTimeout(() => galileoSetState('idle'), 1200);
    }
  } catch (error) {
    if (typingRow) typingRow.remove();
    galileoAddMessage('system', error && error.message ? error.message : 'Galileo could not be reached.');
    galileoSetState('idle');
  } finally {
    galileoBusy = false;
    if (sendButton) sendButton.disabled = false;
    // Talk mode: the turn is over — listen again, unless Galileo is
    // still speaking his reply (his utterance's onend resumes then).
    if (galileoTalkActive && !galileoSpeakingNow) galileoTalkResumeListening();
  }
}

function clearGalileoChat() {
  galileoStopTalkSession(true);
  galileoStopSpeaking();
  galileoHistory = [];
  galileoSave();
  galileoAddMessage('model', GALILEO_GREETING);
  galileoSetState('idle');
}

// ------------------------------------------------------------ init

async function initGalileoChat() {
  const avatarImg = galileoEl('galileo-avatar-img');
  if (avatarImg) avatarImg.src = galileoAvatarSrc();
  const xenaImg = galileoEl('xena-avatar-img');
  if (xenaImg) xenaImg.src = xenaAvatarSrc();

  // Live avatar: if the video loops loaded, the video element replaces
  // the still portrait. If video cannot play, the still stands in.
  // ONE HEAD: this init re-runs on every view open — when the 3D head
  // owns the slot, the video and portrait stay hidden (the 3D script
  // also re-asserts this, but the un-hide must not happen at all).
  const avatarVideo = galileoEl('galileo-avatar-video');
  if (avatarVideo && galileoVideoSrc('idle') && !window.__galileo3dLive) {
    galileoVideoMode = true;
    if (avatarImg) avatarImg.classList.add('hidden');
    avatarVideo.classList.remove('hidden');
    avatarVideo.poster = galileoAvatarSrc();
    if (!avatarVideo.dataset.loop) {
      avatarVideo.dataset.loop = 'idle';
      avatarVideo.src = galileoVideoSrc('idle');
      const play = avatarVideo.play && avatarVideo.play();
      if (play && play.catch) play.catch(() => {});
    }
    avatarVideo.onerror = () => {
      galileoVideoMode = false;
      avatarVideo.classList.add('hidden');
      if (avatarImg && !window.__galileo3dLive) avatarImg.classList.remove('hidden');
    };
  }

  if (galileoInitDone) return;
  galileoInitDone = true;

  galileoLoad();
  if (galileoHistory.length === 0) {
    // First open: Galileo greets first. The greeting is stored, so it
    // stays the first line of the thread — it is not re-sent every open.
    galileoAddMessage('model', GALILEO_GREETING);
    const avatar = galileoAvatarEl();
    if (avatar) {
      avatar.classList.add('welcoming');
      setTimeout(() => avatar.classList.remove('welcoming'), 2600);
    }
  } else {
    galileoRender();
  }

  const voiceButton = galileoEl('galileo-voice');
  if (voiceButton) {
    voiceButton.textContent = galileoVoiceOn ? 'Voice: On' : 'Voice: Off';
    voiceButton.classList.toggle('voice-on', galileoVoiceOn);
  }

  // Brain button reflects the saved choice (Rented by default).
  galileoBrainSetButton();

  // Talk button reflects the saved preference (primed, not listening —
  // the mic needs a tap to start). View hooks stop the session when
  // Matt navigates away or the app goes to the background.
  galileoTalkSetButton();
  galileoInstallViewHooks();

  const input = galileoEl('galileo-input');
  if (input) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        sendGalileoMessage();
      }
    });
  }

  // Ask the Worker whether AI is configured. If it is not, the chat says
  // so plainly and Send is disabled until the key is set.
  try {
    const response = await fetch(GALILEO_AI_BASE + '/health', { method: 'GET' });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data && data.configured === false) {
      const sendButton = galileoEl('galileo-send');
      if (sendButton) sendButton.disabled = true;
      const status = galileoEl('galileo-status');
      if (status) status.textContent = 'AI not set up yet — the owner needs to set the API key.';
      galileoAddMessage('system', 'AI is not configured yet. The owner needs to set the API key before Galileo can answer.');
      return;
    }
    if (response.ok && data && data.trained === false) {
      // The trained brain is not wired on the Worker — the toggle
      // would silently fall back to Gemini, so disable it and say so.
      const brainButton = galileoEl('galileo-brain');
      if (brainButton) {
        brainButton.disabled = true;
        brainButton.textContent = 'Brain: Trained unavailable';
      }
      const callBrainButton = galileoCallEl('galileo-call-brain');
      if (callBrainButton) {
        callBrainButton.disabled = true;
        callBrainButton.textContent = 'Brain: Trained unavailable';
      }
    }
    if (!response.ok) throw new Error('unreachable');
  } catch (e) {
    // Worker unreachable — leave Send enabled; the first send reports it.
  }
  galileoSetState('idle');
}
