/**
 * lincoln-chat.js — Talk to Abraham Lincoln on the GALINYX OS shell.
 *
 * Mirrors franklin-chat.js: a chat with Abraham Lincoln, the
 * civil-law authority and a peer on the council, independent of the
 * Muse app. Lincoln greets first. The chat calls the galinyx-ai
 * Backend Worker's /chat route with character: 'lincoln'; the Worker
 * carries Lincoln's character as its system instruction and calls
 * Gemini with the API key held server-side. No key ever appears in
 * this file, in the shell, or in the repo.
 *
 * Voice: browser-native only — the Web Speech API, same as Galileo.
 * SpeechRecognition takes Matt's voice in, speechSynthesis speaks
 * Lincoln's replies out. No new API keys, no cost, no backend
 * change. Two modes: Speak is push-to-talk (tap, talk, the transcript
 * is sent); Talk is continuous ("like a phone call") — one tap starts
 * a session and recognition auto-restarts after every pause, so Matt
 * just talks back and forth with no button per utterance. Talk pauses
 * listening while Lincoln speaks, so he never hears himself. Honest
 * limit: this is still turn-based under the hood — Matt talks, the
 * transcript goes to the Worker, Lincoln's reply comes back and is
 * spoken aloud, then listening resumes. It is not a true duplex phone
 * stream, and the Worker round trip takes seconds, so there is a
 * pause while Lincoln thinks.
 *
 * Avatar: Alexander Gardner's public-domain O-77 portrait (November
 * 8, 1863), embedded as a data URI in lincoln-avatar.js, which
 * defines LINCOLN_AVATAR. If that file is missing, the still
 * initial "L" stands in.
 *
 * Wiring: this file loads AFTER the shell's inline script, so it can
 * use the shell's showView hook. Every use is guarded, so nothing
 * throws if a file is missing — a simple initial falls back in place
 * of the portrait.
 */

const LINCOLN_AI_BASE = 'https://galinyx-ai.gtmoguap5151.workers.dev';
const LINCOLN_CHAT_KEY = 'galinyx-lincoln-chat-v1';
const LINCOLN_VOICE_KEY = 'galinyx-lincoln-voice-v1';
const LINCOLN_TALK_KEY = 'galinyx-lincoln-talk-v1';
const LINCOLN_MAX_SEND = 12; // turns of history sent per request

// Lincoln greets first, and starts the conversation.
const LINCOLN_GREETING = "Mr. Johnson. I am here to hold the line on the law — plain speech, the strong points and the weak ones, and no word I would not stand behind.";

// Short welcoming lines when Matt taps Lincoln's portrait. Local only —
// no API call, instant, and they cycle so the tap stays alive.
const LINCOLN_TAP_LINES = [
  "I'm here, Mr. Johnson.",
  'Plain speech first — the law is hard enough without fog on it.',
  'Tell me the facts as they stand, and I will tell you where they are weak.',
  'A story can carry a hard point further than an argument.',
];

// Fallback initial if no avatar file is loaded.
const LINCOLN_FALLBACK_AVATAR =
  'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#1c2438"/><text x="64" y="88" font-family="sans-serif" font-size="64" font-weight="bold" fill="#d8cfae" text-anchor="middle">L</text></svg>'
  );

let lincolnHistory = []; // {role:'user'|'model'|'system', text}
let lincolnBusy = false;
let lincolnVoiceOn = false;
let lincolnRecognition = null;
let lincolnListening = false;
let lincolnTapIndex = 0;
let lincolnInitDone = false;
let lincolnSpeakingTimer = null;
let lincolnSpeakingNow = false;
// Continuous Talk mode: one tap starts a session and recognition
// auto-restarts, so Matt talks back and forth like a phone call.
// lincolnTalkActive is the live session; wanted is the persisted
// preference, so the Talk button stays primed next open. paused is
// turn-taking (Lincoln thinking or speaking); recogOn guards against
// duplicate recognition starts, which throw.
let lincolnTalkActive = false;
let lincolnTalkWanted = false;
let lincolnTalkPaused = false;
let lincolnTalkRecogOn = false;
let lincolnTalkErrors = 0;
let lincolnTalkRestartTimer = null;
let lincolnViewHooksInstalled = false;

function lincolnEl(id) {
  return document.getElementById(id);
}

function lincolnAvatarSrc() {
  try {
    return typeof LINCOLN_AVATAR === 'string' && LINCOLN_AVATAR
      ? LINCOLN_AVATAR
      : LINCOLN_FALLBACK_AVATAR;
  } catch (e) {
    return LINCOLN_FALLBACK_AVATAR;
  }
}

// ------------------------------------------------------------ state

// Avatar states: idle | listening | thinking | speaking. The avatar
// shows it (pulse, glow, bob) and the status line says it in words.
function lincolnSetState(state) {
  const avatar = lincolnEl('lincoln-avatar-img');
  const status = lincolnEl('lincoln-status');
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
    thinking: 'Lincoln is thinking…',
    speaking: 'Lincoln is speaking…',
  }[state] || 'Here.';
  status.textContent = label;
}

// ------------------------------------------------------------ history

function lincolnLoad() {
  try {
    const raw = localStorage.getItem(LINCOLN_CHAT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    lincolnHistory = Array.isArray(parsed) ? parsed.filter(
      (m) => m && typeof m.text === 'string' && ['user', 'model', 'system'].indexOf(m.role) !== -1
    ) : [];
  } catch (e) {
    lincolnHistory = [];
  }
  try {
    lincolnVoiceOn = localStorage.getItem(LINCOLN_VOICE_KEY) === 'on';
  } catch (e) {
    lincolnVoiceOn = false;
  }
  try {
    lincolnTalkWanted = localStorage.getItem(LINCOLN_TALK_KEY) === 'on';
  } catch (e) {
    lincolnTalkWanted = false;
  }
}

function lincolnSave() {
  try {
    localStorage.setItem(LINCOLN_CHAT_KEY, JSON.stringify(lincolnHistory.slice(-60)));
  } catch (e) { /* storage unavailable — the chat still works this session */ }
}

function lincolnRender() {
  const log = lincolnEl('lincoln-messages');
  if (!log) return;
  log.textContent = '';
  lincolnHistory.forEach((message) => {
    const row = document.createElement('div');
    row.className = 'chat-msg ' + (message.role === 'user' ? 'matt' : message.role);
    if (message.role === 'model') {
      const thumb = document.createElement('img');
      thumb.className = 'chat-thumb';
      thumb.alt = 'Lincoln';
      thumb.src = lincolnAvatarSrc();
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

function lincolnAddMessage(role, text, save) {
  lincolnHistory.push({ role, text });
  if (save !== false) lincolnSave();
  lincolnRender();
}

// ------------------------------------------------------------ voice

function lincolnSpeak(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    // Lincoln lower and measured — distinct from Galileo's voice.
    utterance.pitch = 0.85;
    utterance.onstart = () => {
      lincolnSpeakingNow = true;
      // Talk mode: stop listening while he speaks, so he never hears himself.
      lincolnTalkPauseListening();
      lincolnSetState('speaking');
    };
    utterance.onend = () => {
      lincolnSpeakingNow = false;
      if (!lincolnBusy) lincolnSetState('idle');
      // Talk mode: his turn is over — listen again.
      lincolnTalkResumeListening();
    };
    utterance.onerror = () => {
      lincolnSpeakingNow = false;
      if (!lincolnBusy) lincolnSetState('idle');
      lincolnTalkResumeListening();
    };
    window.speechSynthesis.speak(utterance);
  } catch (e) { /* speech unavailable — the text reply still stands */ }
}

function lincolnStopSpeaking() {
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  }
  if (lincolnSpeakingTimer) {
    clearTimeout(lincolnSpeakingTimer);
    lincolnSpeakingTimer = null;
  }
}

function lincolnToggleVoice() {
  lincolnVoiceOn = !lincolnVoiceOn;
  try {
    localStorage.setItem(LINCOLN_VOICE_KEY, lincolnVoiceOn ? 'on' : 'off');
  } catch (e) { /* ignore */ }
  const button = lincolnEl('lincoln-voice');
  if (button) {
    button.textContent = lincolnVoiceOn ? 'Voice: On' : 'Voice: Off';
    button.classList.toggle('voice-on', lincolnVoiceOn);
  }
  if (lincolnVoiceOn) {
    const line = 'Good. We will talk it through, plain and straight.';
    lincolnAddMessage('model', line);
    lincolnSpeak(line);
  } else {
    lincolnStopSpeaking();
    if (!lincolnBusy) lincolnSetState('idle');
  }
}

function lincolnToggleMic() {
  if (lincolnTalkActive) {
    // Talk already listens — Speak just ends the Talk session.
    lincolnStopTalkSession(false);
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const button = lincolnEl('lincoln-mic');
  if (!SR) {
    lincolnAddMessage('system', "Voice input isn't supported in this browser — type your message instead.");
    return;
  }
  if (lincolnListening && lincolnRecognition) {
    try { lincolnRecognition.stop(); } catch (e) { /* ignore */ }
    return;
  }
  try {
    lincolnRecognition = new SR();
    lincolnRecognition.lang = 'en-US';
    lincolnRecognition.interimResults = false;
    lincolnRecognition.maxAlternatives = 1;
    lincolnRecognition.onresult = (event) => {
      const transcript = event.results && event.results[0] && event.results[0][0]
        ? event.results[0][0].transcript
        : '';
      if (transcript && transcript.trim()) {
        const input = lincolnEl('lincoln-input');
        if (input) input.value = transcript.trim();
        sendLincolnMessage();
      }
    };
    lincolnRecognition.onerror = (event) => {
      lincolnListening = false;
      lincolnSetState('idle');
      if (button) {
        button.textContent = 'Speak';
        button.classList.remove('listening');
      }
      if (event && event.error === 'not-allowed') {
        lincolnAddMessage('system', 'The microphone is blocked — allow microphone access in the browser, then tap Speak again.');
      } else if (event && event.error !== 'aborted' && event.error !== 'no-speech') {
        lincolnAddMessage('system', "I couldn't hear that — try again, or type it.");
      }
    };
    lincolnRecognition.onend = () => {
      lincolnListening = false;
      if (!lincolnBusy) lincolnSetState('idle');
      if (button) {
        button.textContent = 'Speak';
        button.classList.remove('listening');
      }
    };
    lincolnRecognition.start();
    lincolnListening = true;
    lincolnSetState('listening');
    if (button) {
      button.textContent = 'Listening… tap to stop';
      button.classList.add('listening');
    }
  } catch (e) {
    lincolnAddMessage('system', "The microphone couldn't start — type your message instead.");
  }
}

// ------------------------------------------------------------ continuous Talk mode
//
// One tap starts a voice session; one tap ends it. While the session
// runs, recognition is continuous and auto-restarts on every `onend`
// (Chrome stops recognition after silence even with continuous=true —
// the restart loop is what makes it feel like a phone call). Turn-
// taking: listening pauses while a message is with the Worker and
// while Lincoln speaks, then resumes. Only final transcripts are sent;
// interim results are shown in the status line and never sent.

function lincolnTalkButton() {
  return lincolnEl('lincoln-talk');
}

function lincolnTalkSetButton() {
  const button = lincolnTalkButton();
  if (!button) return;
  if (lincolnTalkActive) {
    button.textContent = 'End Talk';
    button.classList.add('listening');
    button.classList.remove('voice-on');
  } else if (lincolnTalkWanted) {
    button.textContent = 'Talk';
    button.classList.remove('listening');
    button.classList.add('voice-on');
  } else {
    button.textContent = 'Talk';
    button.classList.remove('listening', 'voice-on');
  }
}

function lincolnTalkSavePreference() {
  try {
    localStorage.setItem(LINCOLN_TALK_KEY, lincolnTalkWanted ? 'on' : 'off');
  } catch (e) { /* ignore */ }
}

function lincolnTalkStartRecognition() {
  // Guard against duplicate starts: start() throws while already running.
  if (!lincolnTalkActive || lincolnTalkPaused || lincolnTalkRecogOn) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  try {
    lincolnRecognition = new SR();
    lincolnRecognition.lang = 'en-US';
    lincolnRecognition.continuous = true;
    lincolnRecognition.interimResults = true;
    lincolnRecognition.maxAlternatives = 1;
    lincolnRecognition.onstart = () => {
      lincolnTalkRecogOn = true;
      lincolnTalkErrors = 0;
      if (!lincolnBusy) lincolnSetState('listening');
    };
    lincolnRecognition.onresult = (event) => {
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
        const status = lincolnEl('lincoln-status');
        if (status) status.textContent = 'Hearing: "' + interim.trim().slice(0, 60) + '"';
        return;
      }
      if (finalText && finalText.trim()) {
        lincolnTalkErrors = 0;
        const input = lincolnEl('lincoln-input');
        if (lincolnBusy || lincolnTalkPaused) {
          // Mid-turn (a stop flush, or words spoken while Lincoln was
          // answering): keep the words visible instead of dropping them.
          if (input) input.value = (input.value ? input.value + ' ' : '') + finalText.trim();
          return;
        }
        if (input) input.value = finalText.trim();
        // Pause listening while the message goes to the Worker and
        // Lincoln answers — turn-taking, not a free-for-all.
        lincolnTalkPauseListening();
        sendLincolnMessage();
      }
    };
    lincolnRecognition.onerror = (event) => {
      const err = event && event.error ? event.error : '';
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        lincolnStopTalkSession(true);
        lincolnAddMessage('system', 'The microphone is blocked — allow microphone access in the browser, then tap Talk again.');
        return;
      }
      if (err === 'aborted') return; // our own stop() — not a failure
      // no-speech, network, audio-capture: onend restarts; stop only
      // after repeated failures so a dead mic doesn't spin forever.
      lincolnTalkErrors += 1;
      if (lincolnTalkErrors >= 5) {
        lincolnStopTalkSession(true);
        lincolnAddMessage('system', "I keep losing the microphone — Talk stopped. Tap Talk to try again, or type it.");
      }
    };
    lincolnRecognition.onend = () => {
      lincolnTalkRecogOn = false;
      if (!lincolnTalkActive || lincolnTalkPaused) return;
      // Chrome stops recognition after silence even with continuous=true.
      // Restarting here is what makes Talk feel continuous.
      if (lincolnTalkRestartTimer) clearTimeout(lincolnTalkRestartTimer);
      lincolnTalkRestartTimer = setTimeout(() => {
        lincolnTalkRestartTimer = null;
        lincolnTalkStartRecognition();
      }, 150);
    };
    lincolnRecognition.start();
    lincolnListening = true;
  } catch (e) {
    // start() can throw if the mic is busy or blocked — the session
    // stays up; onerror/onend surfaces the problem if it persists.
    lincolnTalkRecogOn = false;
  }
}

function lincolnTalkPauseListening() {
  if (!lincolnTalkActive) return;
  // Flag first: the stop() below fires onend, which must see the pause
  // and NOT restart recognition.
  lincolnTalkPaused = true;
  if (lincolnTalkRestartTimer) {
    clearTimeout(lincolnTalkRestartTimer);
    lincolnTalkRestartTimer = null;
  }
  if (lincolnRecognition) {
    try { lincolnRecognition.stop(); } catch (e) { /* ignore */ }
  }
  lincolnListening = false;
}

function lincolnTalkResumeListening() {
  if (!lincolnTalkActive || lincolnBusy) return;
  lincolnTalkPaused = false;
  lincolnTalkStartRecognition();
}

function lincolnStartTalkSession() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    lincolnAddMessage('system', "Voice input isn't supported in this browser — type your message instead.");
    return;
  }
  if (!('speechSynthesis' in window)) {
    lincolnAddMessage('system', "This browser can't speak Lincoln's replies out loud — Talk needs spoken replies. Type your message instead.");
    return;
  }
  // One voice session at a time: stop any push-to-talk listen first.
  if (lincolnListening && lincolnRecognition) {
    try { lincolnRecognition.stop(); } catch (e) { /* ignore */ }
  }
  lincolnListening = false;
  lincolnTalkActive = true;
  lincolnTalkWanted = true;
  lincolnTalkPaused = false;
  lincolnTalkErrors = 0;
  lincolnTalkSavePreference();
  // Talk is a conversation — Lincoln's replies are spoken, always. If
  // voice was off, turning it on greets Matt out loud; listening starts
  // when that greeting finishes (the utterance's onend resumes it).
  if (!lincolnVoiceOn) lincolnToggleVoice();
  lincolnTalkSetButton();
  lincolnTalkStartRecognition();
}

function lincolnStopTalkSession(keepPreference) {
  const wasActive = lincolnTalkActive;
  lincolnTalkActive = false;
  lincolnTalkPaused = false;
  if (lincolnTalkRestartTimer) {
    clearTimeout(lincolnTalkRestartTimer);
    lincolnTalkRestartTimer = null;
  }
  if (lincolnRecognition) {
    try { lincolnRecognition.stop(); } catch (e) { /* ignore */ }
  }
  lincolnListening = false;
  lincolnTalkRecogOn = false;
  if (!keepPreference) {
    lincolnTalkWanted = false;
    lincolnTalkSavePreference();
  }
  lincolnStopSpeaking();
  lincolnTalkSetButton();
  if (wasActive && !lincolnBusy) lincolnSetState('idle');
}

function lincolnToggleTalk() {
  if (lincolnTalkActive) {
    lincolnStopTalkSession(false);
  } else {
    lincolnStartTalkSession();
  }
}

// The session ends when Matt leaves the Lincoln view or the app goes
// to the background (a background tab can't hold the mic anyway). The
// preference is kept, so Talk stays primed for next time. The showView
// wrapper composes with Galileo's: each wrapper carries its own flag,
// so both stop their own session when Matt navigates away.
function lincolnInstallViewHooks() {
  if (typeof window.showView === 'function' && !window.showView.__lincolnTalkWrapped) {
    const origShowView = window.showView;
    const wrapped = function (name) {
      if (name !== 'lincoln') lincolnStopTalkSession(true);
      return origShowView(name);
    };
    wrapped.__lincolnTalkWrapped = true;
    window.showView = wrapped;
  }
  if (typeof document !== 'undefined' && document.addEventListener && !lincolnViewHooksInstalled) {
    lincolnViewHooksInstalled = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) lincolnStopTalkSession(true);
    });
  }
}

// ------------------------------------------------------------ taps

function lincolnTap() {
  if (lincolnBusy) return;
  const line = LINCOLN_TAP_LINES[lincolnTapIndex % LINCOLN_TAP_LINES.length];
  lincolnTapIndex += 1;
  lincolnAddMessage('model', line);
  if (lincolnVoiceOn) {
    lincolnSpeak(line);
  } else {
    // A visible reaction even with voice off: the speaking glow, briefly.
    lincolnSetState('speaking');
    lincolnSpeakingTimer = setTimeout(() => lincolnSetState('idle'), 1200);
  }
}

// ------------------------------------------------------------ send

async function sendLincolnMessage() {
  const input = lincolnEl('lincoln-input');
  const sendButton = lincolnEl('lincoln-send');
  const text = input ? input.value.trim() : '';
  if (!text || lincolnBusy) return;

  lincolnStopSpeaking();
  lincolnAddMessage('user', text);
  if (input) input.value = '';
  lincolnBusy = true;
  if (sendButton) sendButton.disabled = true;
  lincolnSetState('thinking');

  // Typing indicator while the Worker answers.
  const log = lincolnEl('lincoln-messages');
  let typingRow = null;
  if (log) {
    typingRow = document.createElement('div');
    typingRow.className = 'chat-msg lincoln typing';
    const thumb = document.createElement('img');
    thumb.className = 'chat-thumb';
    thumb.alt = 'Lincoln';
    thumb.src = lincolnAvatarSrc();
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble typing-dots';
    bubble.innerHTML = '<i></i><i></i><i></i>';
    typingRow.appendChild(thumb);
    typingRow.appendChild(bubble);
    log.appendChild(typingRow);
    log.scrollTop = log.scrollHeight;
  }

  // Only user + Lincoln turns go to the Worker; system lines are
  // local to the thread and never sent.
  const payloadMessages = lincolnHistory
    .filter((m) => m.role === 'user' || m.role === 'model')
    .slice(-LINCOLN_MAX_SEND)
    .map((m) => ({ role: m.role, text: m.text }));

  try {
    // Sign-in gate: the Worker verifies the Supabase session token
    // before answering. No token -> the Worker returns 401 and the
    // error below tells Matt to sign in.
    const token = typeof sbAccessToken === 'function' ? await sbAccessToken() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(LINCOLN_AI_BASE + '/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ character: 'lincoln', messages: payloadMessages }),
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
    if (!reply) throw new Error('Lincoln came back empty — try again.');
    if (typingRow) typingRow.remove();
    lincolnAddMessage('model', reply);
    if (lincolnVoiceOn) {
      lincolnSpeak(reply);
    } else {
      lincolnSetState('speaking');
      lincolnSpeakingTimer = setTimeout(() => lincolnSetState('idle'), 1200);
    }
  } catch (error) {
    if (typingRow) typingRow.remove();
    lincolnAddMessage('system', error && error.message ? error.message : 'Lincoln could not be reached.');
    lincolnSetState('idle');
  } finally {
    lincolnBusy = false;
    if (sendButton) sendButton.disabled = false;
    // Talk mode: the turn is over — listen again, unless Lincoln is
    // still speaking his reply (his utterance's onend resumes then).
    if (lincolnTalkActive && !lincolnSpeakingNow) lincolnTalkResumeListening();
  }
}

function clearLincolnChat() {
  lincolnStopTalkSession(true);
  lincolnStopSpeaking();
  lincolnHistory = [];
  lincolnSave();
  lincolnAddMessage('model', LINCOLN_GREETING);
  lincolnSetState('idle');
}

// ------------------------------------------------------------ init

async function initLincolnChat() {
  const avatarImg = lincolnEl('lincoln-avatar-img');
  if (avatarImg) avatarImg.src = lincolnAvatarSrc();

  if (lincolnInitDone) return;
  lincolnInitDone = true;

  lincolnLoad();
  if (lincolnHistory.length === 0) {
    // First open: Lincoln greets first. The greeting is stored, so it
    // stays the first line of the thread — it is not re-sent every open.
    lincolnAddMessage('model', LINCOLN_GREETING);
    const avatar = lincolnEl('lincoln-avatar-img');
    if (avatar) {
      avatar.classList.add('welcoming');
      setTimeout(() => avatar.classList.remove('welcoming'), 2600);
    }
  } else {
    lincolnRender();
  }

  const voiceButton = lincolnEl('lincoln-voice');
  if (voiceButton) {
    voiceButton.textContent = lincolnVoiceOn ? 'Voice: On' : 'Voice: Off';
    voiceButton.classList.toggle('voice-on', lincolnVoiceOn);
  }

  // Talk button reflects the saved preference (primed, not listening —
  // the mic needs a tap to start). View hooks stop the session when
  // Matt navigates away or the app goes to the background.
  lincolnTalkSetButton();
  lincolnInstallViewHooks();

  const input = lincolnEl('lincoln-input');
  if (input) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        sendLincolnMessage();
      }
    });
  }

  // Ask the Worker whether AI is configured. If it is not, the chat says
  // so plainly and Send is disabled until the key is set.
  try {
    const response = await fetch(LINCOLN_AI_BASE + '/health', { method: 'GET' });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data && data.configured === false) {
      const sendButton = lincolnEl('lincoln-send');
      if (sendButton) sendButton.disabled = true;
      const status = lincolnEl('lincoln-status');
      if (status) status.textContent = 'AI not set up yet — the owner needs to set the API key.';
      lincolnAddMessage('system', 'AI is not configured yet. The owner needs to set the API key before Lincoln can answer.');
      return;
    }
    if (!response.ok) throw new Error('unreachable');
  } catch (e) {
    // Worker unreachable — leave Send enabled; the first send reports it.
  }
  lincolnSetState('idle');
}
