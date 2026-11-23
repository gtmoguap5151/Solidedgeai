/**
 * prova-chat.js — Talk to Einstein on the GALINYX OS shell.
 *
 * Mirrors franklin-chat.js: a chat with Prova, the tester — the
 * trial every build must pass — independent of the Muse app. Prova
 * greets first. The chat calls the galinyx-ai Backend Worker's /chat
 * route with character: 'prova'; the Worker carries Prova's
 * character as its system instruction and calls Gemini with the API
 * key held server-side. No key ever appears in this file, in the
 * shell, or in the repo.
 *
 * Voice: browser-native only — the Web Speech API, same as Galileo.
 * SpeechRecognition takes Matt's voice in, speechSynthesis speaks
 * Prova's replies out. No new API keys, no cost, no backend
 * change. Two modes: Speak is push-to-talk (tap, talk, the transcript
 * is sent); Talk is continuous ("like a phone call") — one tap starts
 * a session and recognition auto-restarts after every pause, so Matt
 * just talks back and forth with no button per utterance. Talk pauses
 * listening while Prova speaks, so he never hears himself. Honest
 * limit: this is still turn-based under the hood — Matt talks, the
 * transcript goes to the Worker, Prova's reply comes back and is
 * spoken aloud, then listening resumes. It is not a true duplex phone
 * stream, and the Worker round trip takes seconds, so there is a
 * pause while Prova thinks.
 *
 * Avatar: Prova has no face at all, so no face is invented for him
 * — the GALINYX orbit-G mark stands in, from orbit-g-avatar.js,
 * which defines ORBIT_G_AVATAR. If that file is missing, the still
 * initial "P" stands in.
 *
 * Wiring: this file loads AFTER the shell's inline script, so it can
 * use the shell's showView hook. Every use is guarded, so nothing
 * throws if a file is missing — a simple initial falls back in place
 * of the mark.
 */

const PROVA_AI_BASE = 'https://galinyx-ai.gtmoguap5151.workers.dev';
const PROVA_CHAT_KEY = 'galinyx-prova-chat-v1';
const PROVA_VOICE_KEY = 'galinyx-prova-voice-v1';
const PROVA_TALK_KEY = 'galinyx-prova-talk-v1';
const PROVA_MAX_SEND = 12; // turns of history sent per request

// Prova greets first, and starts the conversation.
const PROVA_GREETING = "Mr. Johnson. Show me the build — I will put it in a stranger's hands and tell you plainly what breaks, what confuses, and what holds.";

// Short welcoming lines when Matt taps Prova's mark. Local only —
// no API call, instant, and they cycle so the tap stays alive.
const PROVA_TAP_LINES = [
  "I'm here, Mr. Johnson.",
  'Nothing passes until it survives me.',
  "A build that only works in its maker's head does not work.",
  'Show me what you made, and I will show you how it fails.',
];

// Fallback initial if no avatar file is loaded.
const PROVA_FALLBACK_AVATAR =
  'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#2a1c17"/><text x="64" y="88" font-family="sans-serif" font-size="64" font-weight="bold" fill="#e0b8a0" text-anchor="middle">E</text></svg>'
  );

let provaHistory = []; // {role:'user'|'model'|'system', text}
let provaBusy = false;
let provaVoiceOn = false;
let provaRecognition = null;
let provaListening = false;
let provaTapIndex = 0;
let provaInitDone = false;
let provaSpeakingTimer = null;
let provaSpeakingNow = false;
// Continuous Talk mode: one tap starts a session and recognition
// auto-restarts, so Matt talks back and forth like a phone call.
// provaTalkActive is the live session; wanted is the persisted
// preference, so the Talk button stays primed next open. paused is
// turn-taking (Prova thinking or speaking); recogOn guards against
// duplicate recognition starts, which throw.
let provaTalkActive = false;
let provaTalkWanted = false;
let provaTalkPaused = false;
let provaTalkRecogOn = false;
let provaTalkErrors = 0;
let provaTalkRestartTimer = null;
let provaViewHooksInstalled = false;

function provaEl(id) {
  return document.getElementById(id);
}

function provaAvatarSrc() {
  try {
    // No face exists for Prova — the orbit-G mark stands in.
    return typeof ORBIT_G_AVATAR === 'string' && ORBIT_G_AVATAR
      ? ORBIT_G_AVATAR
      : PROVA_FALLBACK_AVATAR;
  } catch (e) {
    return PROVA_FALLBACK_AVATAR;
  }
}

// ------------------------------------------------------------ state

// Avatar states: idle | listening | thinking | speaking. The avatar
// shows it (pulse, glow, bob) and the status line says it in words.
function provaSetState(state) {
  const avatar = provaEl('prova-avatar-img');
  const status = provaEl('prova-status');
  if (avatar) {
    avatar.classList.remove('listening', 'thinking', 'speaking');
    if (state === 'listening' || state === 'thinking' || state === 'speaking') {
      avatar.classList.add(state);
    }
  }
  if (!status) return;
  const label = {
    idle: 'Here — tap his portrait to say hello, or type below.',
    listening: 'Listening… speak now.',
    thinking: 'Einstein is thinking…',
    speaking: 'Einstein is speaking…',
  }[state] || 'Here.';
  status.textContent = label;
}

// ------------------------------------------------------------ history

function provaLoad() {
  try {
    const raw = localStorage.getItem(PROVA_CHAT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    provaHistory = Array.isArray(parsed) ? parsed.filter(
      (m) => m && typeof m.text === 'string' && ['user', 'model', 'system'].indexOf(m.role) !== -1
    ) : [];
  } catch (e) {
    provaHistory = [];
  }
  try {
    provaVoiceOn = localStorage.getItem(PROVA_VOICE_KEY) === 'on';
  } catch (e) {
    provaVoiceOn = false;
  }
  try {
    provaTalkWanted = localStorage.getItem(PROVA_TALK_KEY) === 'on';
  } catch (e) {
    provaTalkWanted = false;
  }
}

function provaSave() {
  try {
    localStorage.setItem(PROVA_CHAT_KEY, JSON.stringify(provaHistory.slice(-60)));
  } catch (e) { /* storage unavailable — the chat still works this session */ }
}

function provaRender() {
  const log = provaEl('prova-messages');
  if (!log) return;
  log.textContent = '';
  provaHistory.forEach((message) => {
    const row = document.createElement('div');
    row.className = 'chat-msg ' + (message.role === 'user' ? 'matt' : message.role);
    if (message.role === 'model') {
      const thumb = document.createElement('img');
      thumb.className = 'chat-thumb';
      thumb.alt = 'Albert Einstein';
      thumb.src = provaAvatarSrc();
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

function provaAddMessage(role, text, save) {
  provaHistory.push({ role, text });
  if (save !== false) provaSave();
  provaRender();
}

// ------------------------------------------------------------ voice

function provaSpeak(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    // Prova steady and blunt — his own voice.
    utterance.pitch = 0.95;
    utterance.onstart = () => {
      provaSpeakingNow = true;
      // Talk mode: stop listening while he speaks, so he never hears himself.
      provaTalkPauseListening();
      provaSetState('speaking');
    };
    utterance.onend = () => {
      provaSpeakingNow = false;
      if (!provaBusy) provaSetState('idle');
      // Talk mode: his turn is over — listen again.
      provaTalkResumeListening();
    };
    utterance.onerror = () => {
      provaSpeakingNow = false;
      if (!provaBusy) provaSetState('idle');
      provaTalkResumeListening();
    };
    window.speechSynthesis.speak(utterance);
  } catch (e) { /* speech unavailable — the text reply still stands */ }
}

function provaStopSpeaking() {
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  }
  if (provaSpeakingTimer) {
    clearTimeout(provaSpeakingTimer);
    provaSpeakingTimer = null;
  }
}

function provaToggleVoice() {
  provaVoiceOn = !provaVoiceOn;
  try {
    localStorage.setItem(PROVA_VOICE_KEY, provaVoiceOn ? 'on' : 'off');
  } catch (e) { /* ignore */ }
  const button = provaEl('prova-voice');
  if (button) {
    button.textContent = provaVoiceOn ? 'Voice: On' : 'Voice: Off';
    button.classList.toggle('voice-on', provaVoiceOn);
  }
  if (provaVoiceOn) {
    const line = 'Good. Now show me what breaks.';
    provaAddMessage('model', line);
    provaSpeak(line);
  } else {
    provaStopSpeaking();
    if (!provaBusy) provaSetState('idle');
  }
}

function provaToggleMic() {
  if (provaTalkActive) {
    // Talk already listens — Speak just ends the Talk session.
    provaStopTalkSession(false);
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const button = provaEl('prova-mic');
  if (!SR) {
    provaAddMessage('system', "Voice input isn't supported in this browser — type your message instead.");
    return;
  }
  if (provaListening && provaRecognition) {
    try { provaRecognition.stop(); } catch (e) { /* ignore */ }
    return;
  }
  try {
    provaRecognition = new SR();
    provaRecognition.lang = 'en-US';
    provaRecognition.interimResults = false;
    provaRecognition.maxAlternatives = 1;
    provaRecognition.onresult = (event) => {
      const transcript = event.results && event.results[0] && event.results[0][0]
        ? event.results[0][0].transcript
        : '';
      if (transcript && transcript.trim()) {
        const input = provaEl('prova-input');
        if (input) input.value = transcript.trim();
        sendProvaMessage();
      }
    };
    provaRecognition.onerror = (event) => {
      provaListening = false;
      provaSetState('idle');
      if (button) {
        button.textContent = 'Speak';
        button.classList.remove('listening');
      }
      if (event && event.error === 'not-allowed') {
        provaAddMessage('system', 'The microphone is blocked — allow microphone access in the browser, then tap Speak again.');
      } else if (event && event.error !== 'aborted' && event.error !== 'no-speech') {
        provaAddMessage('system', "I couldn't hear that — try again, or type it.");
      }
    };
    provaRecognition.onend = () => {
      provaListening = false;
      if (!provaBusy) provaSetState('idle');
      if (button) {
        button.textContent = 'Speak';
        button.classList.remove('listening');
      }
    };
    provaRecognition.start();
    provaListening = true;
    provaSetState('listening');
    if (button) {
      button.textContent = 'Listening… tap to stop';
      button.classList.add('listening');
    }
  } catch (e) {
    provaAddMessage('system', "The microphone couldn't start — type your message instead.");
  }
}

// ------------------------------------------------------------ continuous Talk mode
//
// One tap starts a voice session; one tap ends it. While the session
// runs, recognition is continuous and auto-restarts on every `onend`
// (Chrome stops recognition after silence even with continuous=true —
// the restart loop is what makes it feel like a phone call). Turn-
// taking: listening pauses while a message is with the Worker and
// while Prova speaks, then resumes. Only final transcripts are sent;
// interim results are shown in the status line and never sent.

function provaTalkButton() {
  return provaEl('prova-talk');
}

function provaTalkSetButton() {
  const button = provaTalkButton();
  if (!button) return;
  if (provaTalkActive) {
    button.textContent = 'End Talk';
    button.classList.add('listening');
    button.classList.remove('voice-on');
  } else if (provaTalkWanted) {
    button.textContent = 'Talk';
    button.classList.remove('listening');
    button.classList.add('voice-on');
  } else {
    button.textContent = 'Talk';
    button.classList.remove('listening', 'voice-on');
  }
}

function provaTalkSavePreference() {
  try {
    localStorage.setItem(PROVA_TALK_KEY, provaTalkWanted ? 'on' : 'off');
  } catch (e) { /* ignore */ }
}

function provaTalkStartRecognition() {
  // Guard against duplicate starts: start() throws while already running.
  if (!provaTalkActive || provaTalkPaused || provaTalkRecogOn) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  try {
    provaRecognition = new SR();
    provaRecognition.lang = 'en-US';
    provaRecognition.continuous = true;
    provaRecognition.interimResults = true;
    provaRecognition.maxAlternatives = 1;
    provaRecognition.onstart = () => {
      provaTalkRecogOn = true;
      provaTalkErrors = 0;
      if (!provaBusy) provaSetState('listening');
    };
    provaRecognition.onresult = (event) => {
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
        const status = provaEl('prova-status');
        if (status) status.textContent = 'Hearing: "' + interim.trim().slice(0, 60) + '"';
        return;
      }
      if (finalText && finalText.trim()) {
        provaTalkErrors = 0;
        const input = provaEl('prova-input');
        if (provaBusy || provaTalkPaused) {
          // Mid-turn (a stop flush, or words spoken while Prova was
          // answering): keep the words visible instead of dropping them.
          if (input) input.value = (input.value ? input.value + ' ' : '') + finalText.trim();
          return;
        }
        if (input) input.value = finalText.trim();
        // Pause listening while the message goes to the Worker and
        // Prova answers — turn-taking, not a free-for-all.
        provaTalkPauseListening();
        sendProvaMessage();
      }
    };
    provaRecognition.onerror = (event) => {
      const err = event && event.error ? event.error : '';
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        provaStopTalkSession(true);
        provaAddMessage('system', 'The microphone is blocked — allow microphone access in the browser, then tap Talk again.');
        return;
      }
      if (err === 'aborted') return; // our own stop() — not a failure
      // no-speech, network, audio-capture: onend restarts; stop only
      // after repeated failures so a dead mic doesn't spin forever.
      provaTalkErrors += 1;
      if (provaTalkErrors >= 5) {
        provaStopTalkSession(true);
        provaAddMessage('system', "I keep losing the microphone — Talk stopped. Tap Talk to try again, or type it.");
      }
    };
    provaRecognition.onend = () => {
      provaTalkRecogOn = false;
      if (!provaTalkActive || provaTalkPaused) return;
      // Chrome stops recognition after silence even with continuous=true.
      // Restarting here is what makes Talk feel continuous.
      if (provaTalkRestartTimer) clearTimeout(provaTalkRestartTimer);
      provaTalkRestartTimer = setTimeout(() => {
        provaTalkRestartTimer = null;
        provaTalkStartRecognition();
      }, 150);
    };
    provaRecognition.start();
    provaListening = true;
  } catch (e) {
    // start() can throw if the mic is busy or blocked — the session
    // stays up; onerror/onend surfaces the problem if it persists.
    provaTalkRecogOn = false;
  }
}

function provaTalkPauseListening() {
  if (!provaTalkActive) return;
  // Flag first: the stop() below fires onend, which must see the pause
  // and NOT restart recognition.
  provaTalkPaused = true;
  if (provaTalkRestartTimer) {
    clearTimeout(provaTalkRestartTimer);
    provaTalkRestartTimer = null;
  }
  if (provaRecognition) {
    try { provaRecognition.stop(); } catch (e) { /* ignore */ }
  }
  provaListening = false;
}

function provaTalkResumeListening() {
  if (!provaTalkActive || provaBusy) return;
  provaTalkPaused = false;
  provaTalkStartRecognition();
}

function provaStartTalkSession() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    provaAddMessage('system', "Voice input isn't supported in this browser — type your message instead.");
    return;
  }
  if (!('speechSynthesis' in window)) {
    provaAddMessage('system', "This browser can't speak Einstein's replies out loud — Talk needs spoken replies. Type your message instead.");
    return;
  }
  // One voice session at a time: stop any push-to-talk listen first.
  if (provaListening && provaRecognition) {
    try { provaRecognition.stop(); } catch (e) { /* ignore */ }
  }
  provaListening = false;
  provaTalkActive = true;
  provaTalkWanted = true;
  provaTalkPaused = false;
  provaTalkErrors = 0;
  provaTalkSavePreference();
  // Talk is a conversation — Prova's replies are spoken, always. If
  // voice was off, turning it on greets Matt out loud; listening starts
  // when that greeting finishes (the utterance's onend resumes it).
  if (!provaVoiceOn) provaToggleVoice();
  provaTalkSetButton();
  provaTalkStartRecognition();
}

function provaStopTalkSession(keepPreference) {
  const wasActive = provaTalkActive;
  provaTalkActive = false;
  provaTalkPaused = false;
  if (provaTalkRestartTimer) {
    clearTimeout(provaTalkRestartTimer);
    provaTalkRestartTimer = null;
  }
  if (provaRecognition) {
    try { provaRecognition.stop(); } catch (e) { /* ignore */ }
  }
  provaListening = false;
  provaTalkRecogOn = false;
  if (!keepPreference) {
    provaTalkWanted = false;
    provaTalkSavePreference();
  }
  provaStopSpeaking();
  provaTalkSetButton();
  if (wasActive && !provaBusy) provaSetState('idle');
}

function provaToggleTalk() {
  if (provaTalkActive) {
    provaStopTalkSession(false);
  } else {
    provaStartTalkSession();
  }
}

// The session ends when Matt leaves the Prova view or the app goes
// to the background (a background tab can't hold the mic anyway). The
// preference is kept, so Talk stays primed for next time. The showView
// wrapper composes with Galileo's: each wrapper carries its own flag,
// so both stop their own session when Matt navigates away.
function provaInstallViewHooks() {
  if (typeof window.showView === 'function' && !window.showView.__provaTalkWrapped) {
    const origShowView = window.showView;
    const wrapped = function (name) {
      if (name !== 'prova') provaStopTalkSession(true);
      return origShowView(name);
    };
    wrapped.__provaTalkWrapped = true;
    window.showView = wrapped;
  }
  if (typeof document !== 'undefined' && document.addEventListener && !provaViewHooksInstalled) {
    provaViewHooksInstalled = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) provaStopTalkSession(true);
    });
  }
}

// ------------------------------------------------------------ taps

function provaTap() {
  if (provaBusy) return;
  const line = PROVA_TAP_LINES[provaTapIndex % PROVA_TAP_LINES.length];
  provaTapIndex += 1;
  provaAddMessage('model', line);
  if (provaVoiceOn) {
    provaSpeak(line);
  } else {
    // A visible reaction even with voice off: the speaking glow, briefly.
    provaSetState('speaking');
    provaSpeakingTimer = setTimeout(() => provaSetState('idle'), 1200);
  }
}

// ------------------------------------------------------------ send

async function sendProvaMessage() {
  const input = provaEl('prova-input');
  const sendButton = provaEl('prova-send');
  const text = input ? input.value.trim() : '';
  if (!text || provaBusy) return;

  provaStopSpeaking();
  provaAddMessage('user', text);
  if (input) input.value = '';
  provaBusy = true;
  if (sendButton) sendButton.disabled = true;
  provaSetState('thinking');

  // Typing indicator while the Worker answers.
  const log = provaEl('prova-messages');
  let typingRow = null;
  if (log) {
    typingRow = document.createElement('div');
    typingRow.className = 'chat-msg prova typing';
    const thumb = document.createElement('img');
    thumb.className = 'chat-thumb';
    thumb.alt = 'Albert Einstein';
    thumb.src = provaAvatarSrc();
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble typing-dots';
    bubble.innerHTML = '<i></i><i></i><i></i>';
    typingRow.appendChild(thumb);
    typingRow.appendChild(bubble);
    log.appendChild(typingRow);
    log.scrollTop = log.scrollHeight;
  }

  // Only user + Prova turns go to the Worker; system lines are
  // local to the thread and never sent.
  const payloadMessages = provaHistory
    .filter((m) => m.role === 'user' || m.role === 'model')
    .slice(-PROVA_MAX_SEND)
    .map((m) => ({ role: m.role, text: m.text }));

  try {
    // Sign-in gate: the Worker verifies the Supabase session token
    // before answering. No token -> the Worker returns 401 and the
    // error below tells Matt to sign in.
    const token = typeof sbAccessToken === 'function' ? await sbAccessToken() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(PROVA_AI_BASE + '/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ character: 'prova', messages: payloadMessages }),
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
    if (!reply) throw new Error('Einstein came back empty — try again.');
    if (typingRow) typingRow.remove();
    provaAddMessage('model', reply);
    if (provaVoiceOn) {
      provaSpeak(reply);
    } else {
      provaSetState('speaking');
      provaSpeakingTimer = setTimeout(() => provaSetState('idle'), 1200);
    }
  } catch (error) {
    if (typingRow) typingRow.remove();
    provaAddMessage('system', error && error.message ? error.message : 'Einstein could not be reached.');
    provaSetState('idle');
  } finally {
    provaBusy = false;
    if (sendButton) sendButton.disabled = false;
    // Talk mode: the turn is over — listen again, unless Prova is
    // still speaking his reply (his utterance's onend resumes then).
    if (provaTalkActive && !provaSpeakingNow) provaTalkResumeListening();
  }
}

function clearProvaChat() {
  provaStopTalkSession(true);
  provaStopSpeaking();
  provaHistory = [];
  provaSave();
  provaAddMessage('model', PROVA_GREETING);
  provaSetState('idle');
}

// ------------------------------------------------------------ init

async function initProvaChat() {
  const avatarImg = provaEl('prova-avatar-img');
  if (avatarImg) avatarImg.src = provaAvatarSrc();

  if (provaInitDone) return;
  provaInitDone = true;

  provaLoad();
  if (provaHistory.length === 0) {
    // First open: Prova greets first. The greeting is stored, so it
    // stays the first line of the thread — it is not re-sent every open.
    provaAddMessage('model', PROVA_GREETING);
    const avatar = provaEl('prova-avatar-img');
    if (avatar) {
      avatar.classList.add('welcoming');
      setTimeout(() => avatar.classList.remove('welcoming'), 2600);
    }
  } else {
    provaRender();
  }

  const voiceButton = provaEl('prova-voice');
  if (voiceButton) {
    voiceButton.textContent = provaVoiceOn ? 'Voice: On' : 'Voice: Off';
    voiceButton.classList.toggle('voice-on', provaVoiceOn);
  }

  // Talk button reflects the saved preference (primed, not listening —
  // the mic needs a tap to start). View hooks stop the session when
  // Matt navigates away or the app goes to the background.
  provaTalkSetButton();
  provaInstallViewHooks();

  const input = provaEl('prova-input');
  if (input) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        sendProvaMessage();
      }
    });
  }

  // Ask the Worker whether AI is configured. If it is not, the chat says
  // so plainly and Send is disabled until the key is set.
  try {
    const response = await fetch(PROVA_AI_BASE + '/health', { method: 'GET' });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data && data.configured === false) {
      const sendButton = provaEl('prova-send');
      if (sendButton) sendButton.disabled = true;
      const status = provaEl('prova-status');
      if (status) status.textContent = 'AI not set up yet — the owner needs to set the API key.';
      provaAddMessage('system', 'AI is not configured yet. The owner needs to set the API key before Einstein can answer.');
      return;
    }
    if (!response.ok) throw new Error('unreachable');
  } catch (e) {
    // Worker unreachable — leave Send enabled; the first send reports it.
  }
  provaSetState('idle');
}
