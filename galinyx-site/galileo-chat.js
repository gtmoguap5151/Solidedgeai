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
 * change. This is browser voice, not a live phone-call-style stream:
 * tap Speak, talk, and the transcript is sent as a message.
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
 * Wiring: this file loads AFTER the shell's inline script and the avatar
 * files (galileo-avatar.js, xena-avatar.js), so it can use the shell's
 * showView hook and the GALILEO_AVATAR / XENA_AVATAR constants. Every use
 * is guarded, so nothing throws if a file is missing — a simple initial
 * falls back in place of the portrait.
 */

const GALILEO_AI_BASE = 'https://galinyx-ai.gtmoguap5151.workers.dev';
const GALILEO_CHAT_KEY = 'galinyx-galileo-chat-v1';
const GALILEO_VOICE_KEY = 'galinyx-galileo-voice-v1';
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
let galileoRecognition = null;
let galileoListening = false;
let galileoTapIndex = 0;
let xenaTapIndex = 0;
let galileoInitDone = false;
let galileoSpeakingTimer = null;

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
  if (!status) return;
  const label = {
    idle: 'Here — tap his portrait to say hello, or type below.',
    listening: 'Listening… speak now.',
    thinking: 'Galileo is thinking…',
    speaking: 'Galileo is speaking…',
  }[state] || 'Here.';
  status.textContent = label;
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
  });
  log.scrollTop = log.scrollHeight;
}

function galileoAddMessage(role, text, save) {
  galileoHistory.push({ role, text });
  if (save !== false) galileoSave();
  galileoRender();
}

// ------------------------------------------------------------ voice

function galileoSpeak(text, who) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    // Galileo lower, Xena higher — the two voices stay distinguishable.
    utterance.pitch = who === 'xena' ? 1.3 : 0.9;
    utterance.onstart = () => galileoSetState('speaking');
    utterance.onend = () => { if (!galileoBusy) galileoSetState('idle'); };
    utterance.onerror = () => { if (!galileoBusy) galileoSetState('idle'); };
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

function galileoToggleMic() {
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
    const response = await fetch(GALILEO_AI_BASE + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: payloadMessages }),
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
    galileoAddMessage('model', reply);
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
  }
}

function clearGalileoChat() {
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
  const avatarVideo = galileoEl('galileo-avatar-video');
  if (avatarVideo && galileoVideoSrc('idle')) {
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
      if (avatarImg) avatarImg.classList.remove('hidden');
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
    if (!response.ok) throw new Error('unreachable');
  } catch (e) {
    // Worker unreachable — leave Send enabled; the first send reports it.
  }
  galileoSetState('idle');
}
