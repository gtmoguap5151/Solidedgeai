/**
 * adamo-chat.js — Talk to Adamo on the GALINYX OS shell.
 *
 * Mirrors franklin-chat.js: a chat with Adamo, the Finance Brother
 * and the numbers brain beside Xena, independent of the Muse app.
 * Adamo greets first. The chat calls the galinyx-ai Backend Worker's
 * /chat route with character: 'adamo'; the Worker carries Adamo's
 * character as its system instruction and calls Gemini with the API
 * key held server-side. No key ever appears in this file, in the
 * shell, or in the repo.
 *
 * Voice: browser-native only — the Web Speech API, same as Galileo.
 * SpeechRecognition takes Matt's voice in, speechSynthesis speaks
 * Adamo's replies out. No new API keys, no cost, no backend
 * change. Two modes: Speak is push-to-talk (tap, talk, the transcript
 * is sent); Talk is continuous ("like a phone call") — one tap starts
 * a session and recognition auto-restarts after every pause, so Matt
 * just talks back and forth with no button per utterance. Talk pauses
 * listening while Adamo speaks, so he never hears himself. Honest
 * limit: this is still turn-based under the hood — Matt talks, the
 * transcript goes to the Worker, Adamo's reply comes back and is
 * spoken aloud, then listening resumes. It is not a true duplex phone
 * stream, and the Worker round trip takes seconds, so there is a
 * pause while Adamo thinks.
 *
 * Avatar: no portrait of Adamo Ferraris survives, so no face is
 * invented for him — the GALINYX orbit-G mark stands in, from
 * orbit-g-avatar.js, which defines ORBIT_G_AVATAR. If that file is
 * missing, the still initial "A" stands in.
 *
 * Wiring: this file loads AFTER the shell's inline script, so it can
 * use the shell's showView hook. Every use is guarded, so nothing
 * throws if a file is missing — a simple initial falls back in place
 * of the mark.
 */

const ADAMO_AI_BASE = 'https://galinyx-ai.gtmoguap5151.workers.dev';
const ADAMO_CHAT_KEY = 'galinyx-adamo-chat-v1';
const ADAMO_VOICE_KEY = 'galinyx-adamo-voice-v1';
const ADAMO_TALK_KEY = 'galinyx-adamo-talk-v1';
const ADAMO_MAX_SEND = 12; // turns of history sent per request

// Adamo greets first, and starts the conversation.
const ADAMO_GREETING = "Mr. Johnson. Show me the numbers — clicks, visitors, replies, sales — and I will tell you plainly what is working and what is not.";

// Short welcoming lines when Matt taps Adamo's mark. Local only —
// no API call, instant, and they cycle so the tap stays alive.
const ADAMO_TAP_LINES = [
  "I'm here, Mr. Johnson.",
  'The numbers do not hope. They tell.',
  'Bring me the board and I will find where the money is stuck.',
  'Every dollar we find is a dollar toward the way out.',
];

// Fallback initial if no avatar file is loaded.
const ADAMO_FALLBACK_AVATAR =
  'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#14231a"/><text x="64" y="88" font-family="sans-serif" font-size="64" font-weight="bold" fill="#b8d8a8" text-anchor="middle">A</text></svg>'
  );

let adamoHistory = []; // {role:'user'|'model'|'system', text}
let adamoBusy = false;
let adamoVoiceOn = false;
let adamoRecognition = null;
let adamoListening = false;
let adamoTapIndex = 0;
let adamoInitDone = false;
let adamoSpeakingTimer = null;
let adamoSpeakingNow = false;
// Continuous Talk mode: one tap starts a session and recognition
// auto-restarts, so Matt talks back and forth like a phone call.
// adamoTalkActive is the live session; wanted is the persisted
// preference, so the Talk button stays primed next open. paused is
// turn-taking (Adamo thinking or speaking); recogOn guards against
// duplicate recognition starts, which throw.
let adamoTalkActive = false;
let adamoTalkWanted = false;
let adamoTalkPaused = false;
let adamoTalkRecogOn = false;
let adamoTalkErrors = 0;
let adamoTalkRestartTimer = null;
let adamoViewHooksInstalled = false;

function adamoEl(id) {
  return document.getElementById(id);
}

function adamoAvatarSrc() {
  try {
    // No face exists for Adamo — the orbit-G mark stands in.
    return typeof ORBIT_G_AVATAR === 'string' && ORBIT_G_AVATAR
      ? ORBIT_G_AVATAR
      : ADAMO_FALLBACK_AVATAR;
  } catch (e) {
    return ADAMO_FALLBACK_AVATAR;
  }
}

// ------------------------------------------------------------ state

// Avatar states: idle | listening | thinking | speaking. The avatar
// shows it (pulse, glow, bob) and the status line says it in words.
function adamoSetState(state) {
  const avatar = adamoEl('adamo-avatar-img');
  const status = adamoEl('adamo-status');
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
    thinking: 'Adamo is thinking…',
    speaking: 'Adamo is speaking…',
  }[state] || 'Here.';
  status.textContent = label;
}

// ------------------------------------------------------------ history

function adamoLoad() {
  try {
    const raw = localStorage.getItem(ADAMO_CHAT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    adamoHistory = Array.isArray(parsed) ? parsed.filter(
      (m) => m && typeof m.text === 'string' && ['user', 'model', 'system'].indexOf(m.role) !== -1
    ) : [];
  } catch (e) {
    adamoHistory = [];
  }
  try {
    adamoVoiceOn = localStorage.getItem(ADAMO_VOICE_KEY) === 'on';
  } catch (e) {
    adamoVoiceOn = false;
  }
  try {
    adamoTalkWanted = localStorage.getItem(ADAMO_TALK_KEY) === 'on';
  } catch (e) {
    adamoTalkWanted = false;
  }
}

function adamoSave() {
  try {
    localStorage.setItem(ADAMO_CHAT_KEY, JSON.stringify(adamoHistory.slice(-60)));
  } catch (e) { /* storage unavailable — the chat still works this session */ }
}

function adamoRender() {
  const log = adamoEl('adamo-messages');
  if (!log) return;
  log.textContent = '';
  adamoHistory.forEach((message) => {
    const row = document.createElement('div');
    row.className = 'chat-msg ' + (message.role === 'user' ? 'matt' : message.role);
    if (message.role === 'model') {
      const thumb = document.createElement('img');
      thumb.className = 'chat-thumb';
      thumb.alt = 'Adamo';
      thumb.src = adamoAvatarSrc();
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

function adamoAddMessage(role, text, save) {
  adamoHistory.push({ role, text });
  if (save !== false) adamoSave();
  adamoRender();
}

// ------------------------------------------------------------ voice

function adamoSpeak(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    // Adamo plain and direct — his own voice.
    utterance.pitch = 1.0;
    utterance.onstart = () => {
      adamoSpeakingNow = true;
      // Talk mode: stop listening while he speaks, so he never hears himself.
      adamoTalkPauseListening();
      adamoSetState('speaking');
    };
    utterance.onend = () => {
      adamoSpeakingNow = false;
      if (!adamoBusy) adamoSetState('idle');
      // Talk mode: his turn is over — listen again.
      adamoTalkResumeListening();
    };
    utterance.onerror = () => {
      adamoSpeakingNow = false;
      if (!adamoBusy) adamoSetState('idle');
      adamoTalkResumeListening();
    };
    window.speechSynthesis.speak(utterance);
  } catch (e) { /* speech unavailable — the text reply still stands */ }
}

function adamoStopSpeaking() {
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  }
  if (adamoSpeakingTimer) {
    clearTimeout(adamoSpeakingTimer);
    adamoSpeakingTimer = null;
  }
}

function adamoToggleVoice() {
  adamoVoiceOn = !adamoVoiceOn;
  try {
    localStorage.setItem(ADAMO_VOICE_KEY, adamoVoiceOn ? 'on' : 'off');
  } catch (e) { /* ignore */ }
  const button = adamoEl('adamo-voice');
  if (button) {
    button.textContent = adamoVoiceOn ? 'Voice: On' : 'Voice: Off';
    button.classList.toggle('voice-on', adamoVoiceOn);
  }
  if (adamoVoiceOn) {
    const line = 'Good. Now show me the numbers.';
    adamoAddMessage('model', line);
    adamoSpeak(line);
  } else {
    adamoStopSpeaking();
    if (!adamoBusy) adamoSetState('idle');
  }
}

function adamoToggleMic() {
  if (adamoTalkActive) {
    // Talk already listens — Speak just ends the Talk session.
    adamoStopTalkSession(false);
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const button = adamoEl('adamo-mic');
  if (!SR) {
    adamoAddMessage('system', "Voice input isn't supported in this browser — type your message instead.");
    return;
  }
  if (adamoListening && adamoRecognition) {
    try { adamoRecognition.stop(); } catch (e) { /* ignore */ }
    return;
  }
  try {
    adamoRecognition = new SR();
    adamoRecognition.lang = 'en-US';
    adamoRecognition.interimResults = false;
    adamoRecognition.maxAlternatives = 1;
    adamoRecognition.onresult = (event) => {
      const transcript = event.results && event.results[0] && event.results[0][0]
        ? event.results[0][0].transcript
        : '';
      if (transcript && transcript.trim()) {
        const input = adamoEl('adamo-input');
        if (input) input.value = transcript.trim();
        sendAdamoMessage();
      }
    };
    adamoRecognition.onerror = (event) => {
      adamoListening = false;
      adamoSetState('idle');
      if (button) {
        button.textContent = 'Speak';
        button.classList.remove('listening');
      }
      if (event && event.error === 'not-allowed') {
        adamoAddMessage('system', 'The microphone is blocked — allow microphone access in the browser, then tap Speak again.');
      } else if (event && event.error !== 'aborted' && event.error !== 'no-speech') {
        adamoAddMessage('system', "I couldn't hear that — try again, or type it.");
      }
    };
    adamoRecognition.onend = () => {
      adamoListening = false;
      if (!adamoBusy) adamoSetState('idle');
      if (button) {
        button.textContent = 'Speak';
        button.classList.remove('listening');
      }
    };
    adamoRecognition.start();
    adamoListening = true;
    adamoSetState('listening');
    if (button) {
      button.textContent = 'Listening… tap to stop';
      button.classList.add('listening');
    }
  } catch (e) {
    adamoAddMessage('system', "The microphone couldn't start — type your message instead.");
  }
}

// ------------------------------------------------------------ continuous Talk mode
//
// One tap starts a voice session; one tap ends it. While the session
// runs, recognition is continuous and auto-restarts on every `onend`
// (Chrome stops recognition after silence even with continuous=true —
// the restart loop is what makes it feel like a phone call). Turn-
// taking: listening pauses while a message is with the Worker and
// while Adamo speaks, then resumes. Only final transcripts are sent;
// interim results are shown in the status line and never sent.

function adamoTalkButton() {
  return adamoEl('adamo-talk');
}

function adamoTalkSetButton() {
  const button = adamoTalkButton();
  if (!button) return;
  if (adamoTalkActive) {
    button.textContent = 'End Talk';
    button.classList.add('listening');
    button.classList.remove('voice-on');
  } else if (adamoTalkWanted) {
    button.textContent = 'Talk';
    button.classList.remove('listening');
    button.classList.add('voice-on');
  } else {
    button.textContent = 'Talk';
    button.classList.remove('listening', 'voice-on');
  }
}

function adamoTalkSavePreference() {
  try {
    localStorage.setItem(ADAMO_TALK_KEY, adamoTalkWanted ? 'on' : 'off');
  } catch (e) { /* ignore */ }
}

function adamoTalkStartRecognition() {
  // Guard against duplicate starts: start() throws while already running.
  if (!adamoTalkActive || adamoTalkPaused || adamoTalkRecogOn) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  try {
    adamoRecognition = new SR();
    adamoRecognition.lang = 'en-US';
    adamoRecognition.continuous = true;
    adamoRecognition.interimResults = true;
    adamoRecognition.maxAlternatives = 1;
    adamoRecognition.onstart = () => {
      adamoTalkRecogOn = true;
      adamoTalkErrors = 0;
      if (!adamoBusy) adamoSetState('listening');
    };
    adamoRecognition.onresult = (event) => {
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
        const status = adamoEl('adamo-status');
        if (status) status.textContent = 'Hearing: "' + interim.trim().slice(0, 60) + '"';
        return;
      }
      if (finalText && finalText.trim()) {
        adamoTalkErrors = 0;
        const input = adamoEl('adamo-input');
        if (adamoBusy || adamoTalkPaused) {
          // Mid-turn (a stop flush, or words spoken while Adamo was
          // answering): keep the words visible instead of dropping them.
          if (input) input.value = (input.value ? input.value + ' ' : '') + finalText.trim();
          return;
        }
        if (input) input.value = finalText.trim();
        // Pause listening while the message goes to the Worker and
        // Adamo answers — turn-taking, not a free-for-all.
        adamoTalkPauseListening();
        sendAdamoMessage();
      }
    };
    adamoRecognition.onerror = (event) => {
      const err = event && event.error ? event.error : '';
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        adamoStopTalkSession(true);
        adamoAddMessage('system', 'The microphone is blocked — allow microphone access in the browser, then tap Talk again.');
        return;
      }
      if (err === 'aborted') return; // our own stop() — not a failure
      // no-speech, network, audio-capture: onend restarts; stop only
      // after repeated failures so a dead mic doesn't spin forever.
      adamoTalkErrors += 1;
      if (adamoTalkErrors >= 5) {
        adamoStopTalkSession(true);
        adamoAddMessage('system', "I keep losing the microphone — Talk stopped. Tap Talk to try again, or type it.");
      }
    };
    adamoRecognition.onend = () => {
      adamoTalkRecogOn = false;
      if (!adamoTalkActive || adamoTalkPaused) return;
      // Chrome stops recognition after silence even with continuous=true.
      // Restarting here is what makes Talk feel continuous.
      if (adamoTalkRestartTimer) clearTimeout(adamoTalkRestartTimer);
      adamoTalkRestartTimer = setTimeout(() => {
        adamoTalkRestartTimer = null;
        adamoTalkStartRecognition();
      }, 150);
    };
    adamoRecognition.start();
    adamoListening = true;
  } catch (e) {
    // start() can throw if the mic is busy or blocked — the session
    // stays up; onerror/onend surfaces the problem if it persists.
    adamoTalkRecogOn = false;
  }
}

function adamoTalkPauseListening() {
  if (!adamoTalkActive) return;
  // Flag first: the stop() below fires onend, which must see the pause
  // and NOT restart recognition.
  adamoTalkPaused = true;
  if (adamoTalkRestartTimer) {
    clearTimeout(adamoTalkRestartTimer);
    adamoTalkRestartTimer = null;
  }
  if (adamoRecognition) {
    try { adamoRecognition.stop(); } catch (e) { /* ignore */ }
  }
  adamoListening = false;
}

function adamoTalkResumeListening() {
  if (!adamoTalkActive || adamoBusy) return;
  adamoTalkPaused = false;
  adamoTalkStartRecognition();
}

function adamoStartTalkSession() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    adamoAddMessage('system', "Voice input isn't supported in this browser — type your message instead.");
    return;
  }
  if (!('speechSynthesis' in window)) {
    adamoAddMessage('system', "This browser can't speak Adamo's replies out loud — Talk needs spoken replies. Type your message instead.");
    return;
  }
  // One voice session at a time: stop any push-to-talk listen first.
  if (adamoListening && adamoRecognition) {
    try { adamoRecognition.stop(); } catch (e) { /* ignore */ }
  }
  adamoListening = false;
  adamoTalkActive = true;
  adamoTalkWanted = true;
  adamoTalkPaused = false;
  adamoTalkErrors = 0;
  adamoTalkSavePreference();
  // Talk is a conversation — Adamo's replies are spoken, always. If
  // voice was off, turning it on greets Matt out loud; listening starts
  // when that greeting finishes (the utterance's onend resumes it).
  if (!adamoVoiceOn) adamoToggleVoice();
  adamoTalkSetButton();
  adamoTalkStartRecognition();
}

function adamoStopTalkSession(keepPreference) {
  const wasActive = adamoTalkActive;
  adamoTalkActive = false;
  adamoTalkPaused = false;
  if (adamoTalkRestartTimer) {
    clearTimeout(adamoTalkRestartTimer);
    adamoTalkRestartTimer = null;
  }
  if (adamoRecognition) {
    try { adamoRecognition.stop(); } catch (e) { /* ignore */ }
  }
  adamoListening = false;
  adamoTalkRecogOn = false;
  if (!keepPreference) {
    adamoTalkWanted = false;
    adamoTalkSavePreference();
  }
  adamoStopSpeaking();
  adamoTalkSetButton();
  if (wasActive && !adamoBusy) adamoSetState('idle');
}

function adamoToggleTalk() {
  if (adamoTalkActive) {
    adamoStopTalkSession(false);
  } else {
    adamoStartTalkSession();
  }
}

// The session ends when Matt leaves the Adamo view or the app goes
// to the background (a background tab can't hold the mic anyway). The
// preference is kept, so Talk stays primed for next time. The showView
// wrapper composes with Galileo's: each wrapper carries its own flag,
// so both stop their own session when Matt navigates away.
function adamoInstallViewHooks() {
  if (typeof window.showView === 'function' && !window.showView.__adamoTalkWrapped) {
    const origShowView = window.showView;
    const wrapped = function (name) {
      if (name !== 'adamo') adamoStopTalkSession(true);
      return origShowView(name);
    };
    wrapped.__adamoTalkWrapped = true;
    window.showView = wrapped;
  }
  if (typeof document !== 'undefined' && document.addEventListener && !adamoViewHooksInstalled) {
    adamoViewHooksInstalled = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) adamoStopTalkSession(true);
    });
  }
}

// ------------------------------------------------------------ taps

function adamoTap() {
  if (adamoBusy) return;
  const line = ADAMO_TAP_LINES[adamoTapIndex % ADAMO_TAP_LINES.length];
  adamoTapIndex += 1;
  adamoAddMessage('model', line);
  if (adamoVoiceOn) {
    adamoSpeak(line);
  } else {
    // A visible reaction even with voice off: the speaking glow, briefly.
    adamoSetState('speaking');
    adamoSpeakingTimer = setTimeout(() => adamoSetState('idle'), 1200);
  }
}

// ------------------------------------------------------------ send

async function sendAdamoMessage() {
  const input = adamoEl('adamo-input');
  const sendButton = adamoEl('adamo-send');
  const text = input ? input.value.trim() : '';
  if (!text || adamoBusy) return;

  adamoStopSpeaking();
  adamoAddMessage('user', text);
  if (input) input.value = '';
  adamoBusy = true;
  if (sendButton) sendButton.disabled = true;
  adamoSetState('thinking');

  // Typing indicator while the Worker answers.
  const log = adamoEl('adamo-messages');
  let typingRow = null;
  if (log) {
    typingRow = document.createElement('div');
    typingRow.className = 'chat-msg adamo typing';
    const thumb = document.createElement('img');
    thumb.className = 'chat-thumb';
    thumb.alt = 'Adamo';
    thumb.src = adamoAvatarSrc();
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble typing-dots';
    bubble.innerHTML = '<i></i><i></i><i></i>';
    typingRow.appendChild(thumb);
    typingRow.appendChild(bubble);
    log.appendChild(typingRow);
    log.scrollTop = log.scrollHeight;
  }

  // Only user + Adamo turns go to the Worker; system lines are
  // local to the thread and never sent.
  const payloadMessages = adamoHistory
    .filter((m) => m.role === 'user' || m.role === 'model')
    .slice(-ADAMO_MAX_SEND)
    .map((m) => ({ role: m.role, text: m.text }));

  try {
    // Sign-in gate: the Worker verifies the Supabase session token
    // before answering. No token -> the Worker returns 401 and the
    // error below tells Matt to sign in.
    const token = typeof sbAccessToken === 'function' ? await sbAccessToken() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(ADAMO_AI_BASE + '/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ character: 'adamo', messages: payloadMessages }),
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
    if (!reply) throw new Error('Adamo came back empty — try again.');
    if (typingRow) typingRow.remove();
    adamoAddMessage('model', reply);
    if (adamoVoiceOn) {
      adamoSpeak(reply);
    } else {
      adamoSetState('speaking');
      adamoSpeakingTimer = setTimeout(() => adamoSetState('idle'), 1200);
    }
  } catch (error) {
    if (typingRow) typingRow.remove();
    adamoAddMessage('system', error && error.message ? error.message : 'Adamo could not be reached.');
    adamoSetState('idle');
  } finally {
    adamoBusy = false;
    if (sendButton) sendButton.disabled = false;
    // Talk mode: the turn is over — listen again, unless Adamo is
    // still speaking his reply (his utterance's onend resumes then).
    if (adamoTalkActive && !adamoSpeakingNow) adamoTalkResumeListening();
  }
}

function clearAdamoChat() {
  adamoStopTalkSession(true);
  adamoStopSpeaking();
  adamoHistory = [];
  adamoSave();
  adamoAddMessage('model', ADAMO_GREETING);
  adamoSetState('idle');
}

// ------------------------------------------------------------ init

async function initAdamoChat() {
  const avatarImg = adamoEl('adamo-avatar-img');
  if (avatarImg) avatarImg.src = adamoAvatarSrc();

  if (adamoInitDone) return;
  adamoInitDone = true;

  adamoLoad();
  if (adamoHistory.length === 0) {
    // First open: Adamo greets first. The greeting is stored, so it
    // stays the first line of the thread — it is not re-sent every open.
    adamoAddMessage('model', ADAMO_GREETING);
    const avatar = adamoEl('adamo-avatar-img');
    if (avatar) {
      avatar.classList.add('welcoming');
      setTimeout(() => avatar.classList.remove('welcoming'), 2600);
    }
  } else {
    adamoRender();
  }

  const voiceButton = adamoEl('adamo-voice');
  if (voiceButton) {
    voiceButton.textContent = adamoVoiceOn ? 'Voice: On' : 'Voice: Off';
    voiceButton.classList.toggle('voice-on', adamoVoiceOn);
  }

  // Talk button reflects the saved preference (primed, not listening —
  // the mic needs a tap to start). View hooks stop the session when
  // Matt navigates away or the app goes to the background.
  adamoTalkSetButton();
  adamoInstallViewHooks();

  const input = adamoEl('adamo-input');
  if (input) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        sendAdamoMessage();
      }
    });
  }

  // Ask the Worker whether AI is configured. If it is not, the chat says
  // so plainly and Send is disabled until the key is set.
  try {
    const response = await fetch(ADAMO_AI_BASE + '/health', { method: 'GET' });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data && data.configured === false) {
      const sendButton = adamoEl('adamo-send');
      if (sendButton) sendButton.disabled = true;
      const status = adamoEl('adamo-status');
      if (status) status.textContent = 'AI not set up yet — the owner needs to set the API key.';
      adamoAddMessage('system', 'AI is not configured yet. The owner needs to set the API key before Adamo can answer.');
      return;
    }
    if (!response.ok) throw new Error('unreachable');
  } catch (e) {
    // Worker unreachable — leave Send enabled; the first send reports it.
  }
  adamoSetState('idle');
}
