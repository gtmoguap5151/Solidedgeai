/**
 * franklin-chat.js — Talk to Benjamin Franklin on the GALINYX OS shell.
 *
 * Mirrors galileo-chat.js: a chat with Benjamin Franklin, the Scout's
 * character and Matt's new-ventures advisor, independent of the Muse
 * app. Franklin greets first — the owner's rule (Nov 20, 2026). The
 * chat calls the galinyx-ai Backend Worker's /chat route with
 * character: 'franklin'; the Worker carries Franklin's character as
 * its system instruction and calls Gemini with the API key held
 * server-side. No key ever appears in this file, in the shell, or in
 * the repo.
 *
 * Voice: browser-native only — the Web Speech API, same as Galileo.
 * SpeechRecognition takes Matt's voice in, speechSynthesis speaks
 * Franklin's replies out. No new API keys, no cost, no backend
 * change. Two modes: Speak is push-to-talk (tap, talk, the transcript
 * is sent); Talk is continuous ("like a phone call") — one tap starts
 * a session and recognition auto-restarts after every pause, so Matt
 * just talks back and forth with no button per utterance. Talk pauses
 * listening while Franklin speaks, so he never hears himself. Honest
 * limit: this is still turn-based under the hood — Matt talks, the
 * transcript goes to the Worker, Franklin's reply comes back and is
 * spoken aloud, then listening resumes. It is not a true duplex phone
 * stream, and the Worker round trip takes seconds, so there is a
 * pause while Franklin thinks.
 *
 * Avatar: Franklin has no portrait or video loops yet — the still
 * initial "F" stands in. If a franklin-avatar.js file is added later
 * defining FRANKLIN_AVATAR, it is picked up automatically (guarded,
 * same pattern as Galileo).
 *
 * Wiring: this file loads AFTER the shell's inline script, so it can
 * use the shell's showView hook. Every use is guarded, so nothing
 * throws if a file is missing — a simple initial falls back in place
 * of the portrait.
 */

const FRANKLIN_AI_BASE = 'https://galinyx-ai.gtmoguap5151.workers.dev';
const FRANKLIN_CHAT_KEY = 'galinyx-franklin-chat-v1';
const FRANKLIN_VOICE_KEY = 'galinyx-franklin-voice-v1';
const FRANKLIN_TALK_KEY = 'galinyx-franklin-talk-v1';
const FRANKLIN_MAX_SEND = 12; // turns of history sent per request

// Franklin greets first, and starts the conversation — the owner's
// rule. His opening line, from the character file (Nov 20, 2026).
const FRANKLIN_GREETING = "Mr. Johnson. A penny saved is a penny earned — but a dollar earned is better. I have five ventures for your consideration, and I will tell you plainly which is strongest.";

// Short welcoming lines when Matt taps Franklin's portrait. Local only —
// no API call, instant, and they cycle so the tap stays alive.
const FRANKLIN_TAP_LINES = [
  "I'm here, Mr. Johnson.",
  'A penny saved is a penny earned — but a dollar earned is better.',
  "Bring me a venture and I'll tell you plainly what it's worth.",
  'Time is money, sir — and yours is well spent building.',
];

// Fallback initial if no avatar file is loaded.
const FRANKLIN_FALLBACK_AVATAR =
  'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#3a2a17"/><text x="64" y="88" font-family="sans-serif" font-size="64" font-weight="bold" fill="#e9c77a" text-anchor="middle">F</text></svg>'
  );

let franklinHistory = []; // {role:'user'|'model'|'system', text}
let franklinBusy = false;
let franklinVoiceOn = false;
let franklinRecognition = null;
let franklinListening = false;
let franklinTapIndex = 0;
let franklinInitDone = false;
let franklinSpeakingTimer = null;
let franklinSpeakingNow = false;
// Continuous Talk mode: one tap starts a session and recognition
// auto-restarts, so Matt talks back and forth like a phone call.
// franklinTalkActive is the live session; wanted is the persisted
// preference, so the Talk button stays primed next open. paused is
// turn-taking (Franklin thinking or speaking); recogOn guards against
// duplicate recognition starts, which throw.
let franklinTalkActive = false;
let franklinTalkWanted = false;
let franklinTalkPaused = false;
let franklinTalkRecogOn = false;
let franklinTalkErrors = 0;
let franklinTalkRestartTimer = null;
let franklinViewHooksInstalled = false;

function franklinEl(id) {
  return document.getElementById(id);
}

function franklinAvatarSrc() {
  try {
    return typeof FRANKLIN_AVATAR === 'string' && FRANKLIN_AVATAR
      ? FRANKLIN_AVATAR
      : FRANKLIN_FALLBACK_AVATAR;
  } catch (e) {
    return FRANKLIN_FALLBACK_AVATAR;
  }
}

// ------------------------------------------------------------ state

// Avatar states: idle | listening | thinking | speaking. The avatar
// shows it (pulse, glow, bob) and the status line says it in words.
function franklinSetState(state) {
  const avatar = franklinEl('franklin-avatar-img');
  const status = franklinEl('franklin-status');
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
    thinking: 'Franklin is thinking…',
    speaking: 'Franklin is speaking…',
  }[state] || 'Here.';
  status.textContent = label;
}

// ------------------------------------------------------------ history

function franklinLoad() {
  try {
    const raw = localStorage.getItem(FRANKLIN_CHAT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    franklinHistory = Array.isArray(parsed) ? parsed.filter(
      (m) => m && typeof m.text === 'string' && ['user', 'model', 'system'].indexOf(m.role) !== -1
    ) : [];
  } catch (e) {
    franklinHistory = [];
  }
  try {
    franklinVoiceOn = localStorage.getItem(FRANKLIN_VOICE_KEY) === 'on';
  } catch (e) {
    franklinVoiceOn = false;
  }
  try {
    franklinTalkWanted = localStorage.getItem(FRANKLIN_TALK_KEY) === 'on';
  } catch (e) {
    franklinTalkWanted = false;
  }
}

function franklinSave() {
  try {
    localStorage.setItem(FRANKLIN_CHAT_KEY, JSON.stringify(franklinHistory.slice(-60)));
  } catch (e) { /* storage unavailable — the chat still works this session */ }
}

function franklinRender() {
  const log = franklinEl('franklin-messages');
  if (!log) return;
  log.textContent = '';
  franklinHistory.forEach((message) => {
    const row = document.createElement('div');
    row.className = 'chat-msg ' + (message.role === 'user' ? 'matt' : message.role);
    if (message.role === 'model') {
      const thumb = document.createElement('img');
      thumb.className = 'chat-thumb';
      thumb.alt = 'Franklin';
      thumb.src = franklinAvatarSrc();
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

function franklinAddMessage(role, text, save) {
  franklinHistory.push({ role, text });
  if (save !== false) franklinSave();
  franklinRender();
}

// ------------------------------------------------------------ voice

function franklinSpeak(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    // Franklin lower and older — distinct from Galileo's voice.
    utterance.pitch = 0.8;
    utterance.onstart = () => {
      franklinSpeakingNow = true;
      // Talk mode: stop listening while he speaks, so he never hears himself.
      franklinTalkPauseListening();
      franklinSetState('speaking');
    };
    utterance.onend = () => {
      franklinSpeakingNow = false;
      if (!franklinBusy) franklinSetState('idle');
      // Talk mode: his turn is over — listen again.
      franklinTalkResumeListening();
    };
    utterance.onerror = () => {
      franklinSpeakingNow = false;
      if (!franklinBusy) franklinSetState('idle');
      franklinTalkResumeListening();
    };
    window.speechSynthesis.speak(utterance);
  } catch (e) { /* speech unavailable — the text reply still stands */ }
}

function franklinStopSpeaking() {
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  }
  if (franklinSpeakingTimer) {
    clearTimeout(franklinSpeakingTimer);
    franklinSpeakingTimer = null;
  }
}

function franklinToggleVoice() {
  franklinVoiceOn = !franklinVoiceOn;
  try {
    localStorage.setItem(FRANKLIN_VOICE_KEY, franklinVoiceOn ? 'on' : 'off');
  } catch (e) { /* ignore */ }
  const button = franklinEl('franklin-voice');
  if (button) {
    button.textContent = franklinVoiceOn ? 'Voice: On' : 'Voice: Off';
    button.classList.toggle('voice-on', franklinVoiceOn);
  }
  if (franklinVoiceOn) {
    const line = 'Good — now we can talk it through, plain as print.';
    franklinAddMessage('model', line);
    franklinSpeak(line);
  } else {
    franklinStopSpeaking();
    if (!franklinBusy) franklinSetState('idle');
  }
}

function franklinToggleMic() {
  if (franklinTalkActive) {
    // Talk already listens — Speak just ends the Talk session.
    franklinStopTalkSession(false);
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const button = franklinEl('franklin-mic');
  if (!SR) {
    franklinAddMessage('system', "Voice input isn't supported in this browser — type your message instead.");
    return;
  }
  if (franklinListening && franklinRecognition) {
    try { franklinRecognition.stop(); } catch (e) { /* ignore */ }
    return;
  }
  try {
    franklinRecognition = new SR();
    franklinRecognition.lang = 'en-US';
    franklinRecognition.interimResults = false;
    franklinRecognition.maxAlternatives = 1;
    franklinRecognition.onresult = (event) => {
      const transcript = event.results && event.results[0] && event.results[0][0]
        ? event.results[0][0].transcript
        : '';
      if (transcript && transcript.trim()) {
        const input = franklinEl('franklin-input');
        if (input) input.value = transcript.trim();
        sendFranklinMessage();
      }
    };
    franklinRecognition.onerror = (event) => {
      franklinListening = false;
      franklinSetState('idle');
      if (button) {
        button.textContent = 'Speak';
        button.classList.remove('listening');
      }
      if (event && event.error === 'not-allowed') {
        franklinAddMessage('system', 'The microphone is blocked — allow microphone access in the browser, then tap Speak again.');
      } else if (event && event.error !== 'aborted' && event.error !== 'no-speech') {
        franklinAddMessage('system', "I couldn't hear that — try again, or type it.");
      }
    };
    franklinRecognition.onend = () => {
      franklinListening = false;
      if (!franklinBusy) franklinSetState('idle');
      if (button) {
        button.textContent = 'Speak';
        button.classList.remove('listening');
      }
    };
    franklinRecognition.start();
    franklinListening = true;
    franklinSetState('listening');
    if (button) {
      button.textContent = 'Listening… tap to stop';
      button.classList.add('listening');
    }
  } catch (e) {
    franklinAddMessage('system', "The microphone couldn't start — type your message instead.");
  }
}

// ------------------------------------------------------------ continuous Talk mode
//
// One tap starts a voice session; one tap ends it. While the session
// runs, recognition is continuous and auto-restarts on every `onend`
// (Chrome stops recognition after silence even with continuous=true —
// the restart loop is what makes it feel like a phone call). Turn-
// taking: listening pauses while a message is with the Worker and
// while Franklin speaks, then resumes. Only final transcripts are sent;
// interim results are shown in the status line and never sent.

function franklinTalkButton() {
  return franklinEl('franklin-talk');
}

function franklinTalkSetButton() {
  const button = franklinTalkButton();
  if (!button) return;
  if (franklinTalkActive) {
    button.textContent = 'End Talk';
    button.classList.add('listening');
    button.classList.remove('voice-on');
  } else if (franklinTalkWanted) {
    button.textContent = 'Talk';
    button.classList.remove('listening');
    button.classList.add('voice-on');
  } else {
    button.textContent = 'Talk';
    button.classList.remove('listening', 'voice-on');
  }
}

function franklinTalkSavePreference() {
  try {
    localStorage.setItem(FRANKLIN_TALK_KEY, franklinTalkWanted ? 'on' : 'off');
  } catch (e) { /* ignore */ }
}

function franklinTalkStartRecognition() {
  // Guard against duplicate starts: start() throws while already running.
  if (!franklinTalkActive || franklinTalkPaused || franklinTalkRecogOn) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  try {
    franklinRecognition = new SR();
    franklinRecognition.lang = 'en-US';
    franklinRecognition.continuous = true;
    franklinRecognition.interimResults = true;
    franklinRecognition.maxAlternatives = 1;
    franklinRecognition.onstart = () => {
      franklinTalkRecogOn = true;
      franklinTalkErrors = 0;
      if (!franklinBusy) franklinSetState('listening');
    };
    franklinRecognition.onresult = (event) => {
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
        const status = franklinEl('franklin-status');
        if (status) status.textContent = 'Hearing: "' + interim.trim().slice(0, 60) + '"';
        return;
      }
      if (finalText && finalText.trim()) {
        franklinTalkErrors = 0;
        const input = franklinEl('franklin-input');
        if (franklinBusy || franklinTalkPaused) {
          // Mid-turn (a stop flush, or words spoken while Franklin was
          // answering): keep the words visible instead of dropping them.
          if (input) input.value = (input.value ? input.value + ' ' : '') + finalText.trim();
          return;
        }
        if (input) input.value = finalText.trim();
        // Pause listening while the message goes to the Worker and
        // Franklin answers — turn-taking, not a free-for-all.
        franklinTalkPauseListening();
        sendFranklinMessage();
      }
    };
    franklinRecognition.onerror = (event) => {
      const err = event && event.error ? event.error : '';
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        franklinStopTalkSession(true);
        franklinAddMessage('system', 'The microphone is blocked — allow microphone access in the browser, then tap Talk again.');
        return;
      }
      if (err === 'aborted') return; // our own stop() — not a failure
      // no-speech, network, audio-capture: onend restarts; stop only
      // after repeated failures so a dead mic doesn't spin forever.
      franklinTalkErrors += 1;
      if (franklinTalkErrors >= 5) {
        franklinStopTalkSession(true);
        franklinAddMessage('system', "I keep losing the microphone — Talk stopped. Tap Talk to try again, or type it.");
      }
    };
    franklinRecognition.onend = () => {
      franklinTalkRecogOn = false;
      if (!franklinTalkActive || franklinTalkPaused) return;
      // Chrome stops recognition after silence even with continuous=true.
      // Restarting here is what makes Talk feel continuous.
      if (franklinTalkRestartTimer) clearTimeout(franklinTalkRestartTimer);
      franklinTalkRestartTimer = setTimeout(() => {
        franklinTalkRestartTimer = null;
        franklinTalkStartRecognition();
      }, 150);
    };
    franklinRecognition.start();
    franklinListening = true;
  } catch (e) {
    // start() can throw if the mic is busy or blocked — the session
    // stays up; onerror/onend surfaces the problem if it persists.
    franklinTalkRecogOn = false;
  }
}

function franklinTalkPauseListening() {
  if (!franklinTalkActive) return;
  // Flag first: the stop() below fires onend, which must see the pause
  // and NOT restart recognition.
  franklinTalkPaused = true;
  if (franklinTalkRestartTimer) {
    clearTimeout(franklinTalkRestartTimer);
    franklinTalkRestartTimer = null;
  }
  if (franklinRecognition) {
    try { franklinRecognition.stop(); } catch (e) { /* ignore */ }
  }
  franklinListening = false;
}

function franklinTalkResumeListening() {
  if (!franklinTalkActive || franklinBusy) return;
  franklinTalkPaused = false;
  franklinTalkStartRecognition();
}

function franklinStartTalkSession() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    franklinAddMessage('system', "Voice input isn't supported in this browser — type your message instead.");
    return;
  }
  if (!('speechSynthesis' in window)) {
    franklinAddMessage('system', "This browser can't speak Franklin's replies out loud — Talk needs spoken replies. Type your message instead.");
    return;
  }
  // One voice session at a time: stop any push-to-talk listen first.
  if (franklinListening && franklinRecognition) {
    try { franklinRecognition.stop(); } catch (e) { /* ignore */ }
  }
  franklinListening = false;
  franklinTalkActive = true;
  franklinTalkWanted = true;
  franklinTalkPaused = false;
  franklinTalkErrors = 0;
  franklinTalkSavePreference();
  // Talk is a conversation — Franklin's replies are spoken, always. If
  // voice was off, turning it on greets Matt out loud; listening starts
  // when that greeting finishes (the utterance's onend resumes it).
  if (!franklinVoiceOn) franklinToggleVoice();
  franklinTalkSetButton();
  franklinTalkStartRecognition();
}

function franklinStopTalkSession(keepPreference) {
  const wasActive = franklinTalkActive;
  franklinTalkActive = false;
  franklinTalkPaused = false;
  if (franklinTalkRestartTimer) {
    clearTimeout(franklinTalkRestartTimer);
    franklinTalkRestartTimer = null;
  }
  if (franklinRecognition) {
    try { franklinRecognition.stop(); } catch (e) { /* ignore */ }
  }
  franklinListening = false;
  franklinTalkRecogOn = false;
  if (!keepPreference) {
    franklinTalkWanted = false;
    franklinTalkSavePreference();
  }
  franklinStopSpeaking();
  franklinTalkSetButton();
  if (wasActive && !franklinBusy) franklinSetState('idle');
}

function franklinToggleTalk() {
  if (franklinTalkActive) {
    franklinStopTalkSession(false);
  } else {
    franklinStartTalkSession();
  }
}

// The session ends when Matt leaves the Franklin view or the app goes
// to the background (a background tab can't hold the mic anyway). The
// preference is kept, so Talk stays primed for next time. The showView
// wrapper composes with Galileo's: each wrapper carries its own flag,
// so both stop their own session when Matt navigates away.
function franklinInstallViewHooks() {
  if (typeof window.showView === 'function' && !window.showView.__franklinTalkWrapped) {
    const origShowView = window.showView;
    const wrapped = function (name) {
      if (name !== 'franklin') franklinStopTalkSession(true);
      return origShowView(name);
    };
    wrapped.__franklinTalkWrapped = true;
    window.showView = wrapped;
  }
  if (typeof document !== 'undefined' && document.addEventListener && !franklinViewHooksInstalled) {
    franklinViewHooksInstalled = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) franklinStopTalkSession(true);
    });
  }
}

// ------------------------------------------------------------ taps

function franklinTap() {
  if (franklinBusy) return;
  const line = FRANKLIN_TAP_LINES[franklinTapIndex % FRANKLIN_TAP_LINES.length];
  franklinTapIndex += 1;
  franklinAddMessage('model', line);
  if (franklinVoiceOn) {
    franklinSpeak(line);
  } else {
    // A visible reaction even with voice off: the speaking glow, briefly.
    franklinSetState('speaking');
    franklinSpeakingTimer = setTimeout(() => franklinSetState('idle'), 1200);
  }
}

// ------------------------------------------------------------ send

async function sendFranklinMessage() {
  const input = franklinEl('franklin-input');
  const sendButton = franklinEl('franklin-send');
  const text = input ? input.value.trim() : '';
  if (!text || franklinBusy) return;

  franklinStopSpeaking();
  franklinAddMessage('user', text);
  if (input) input.value = '';
  franklinBusy = true;
  if (sendButton) sendButton.disabled = true;
  franklinSetState('thinking');

  // Typing indicator while the Worker answers.
  const log = franklinEl('franklin-messages');
  let typingRow = null;
  if (log) {
    typingRow = document.createElement('div');
    typingRow.className = 'chat-msg franklin typing';
    const thumb = document.createElement('img');
    thumb.className = 'chat-thumb';
    thumb.alt = 'Franklin';
    thumb.src = franklinAvatarSrc();
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble typing-dots';
    bubble.innerHTML = '<i></i><i></i><i></i>';
    typingRow.appendChild(thumb);
    typingRow.appendChild(bubble);
    log.appendChild(typingRow);
    log.scrollTop = log.scrollHeight;
  }

  // Only user + Franklin turns go to the Worker; system lines are
  // local to the thread and never sent.
  const payloadMessages = franklinHistory
    .filter((m) => m.role === 'user' || m.role === 'model')
    .slice(-FRANKLIN_MAX_SEND)
    .map((m) => ({ role: m.role, text: m.text }));

  try {
    const response = await fetch(FRANKLIN_AI_BASE + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character: 'franklin', messages: payloadMessages }),
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
    if (!reply) throw new Error('Franklin came back empty — try again.');
    if (typingRow) typingRow.remove();
    franklinAddMessage('model', reply);
    if (franklinVoiceOn) {
      franklinSpeak(reply);
    } else {
      franklinSetState('speaking');
      franklinSpeakingTimer = setTimeout(() => franklinSetState('idle'), 1200);
    }
  } catch (error) {
    if (typingRow) typingRow.remove();
    franklinAddMessage('system', error && error.message ? error.message : 'Franklin could not be reached.');
    franklinSetState('idle');
  } finally {
    franklinBusy = false;
    if (sendButton) sendButton.disabled = false;
    // Talk mode: the turn is over — listen again, unless Franklin is
    // still speaking his reply (his utterance's onend resumes then).
    if (franklinTalkActive && !franklinSpeakingNow) franklinTalkResumeListening();
  }
}

function clearFranklinChat() {
  franklinStopTalkSession(true);
  franklinStopSpeaking();
  franklinHistory = [];
  franklinSave();
  franklinAddMessage('model', FRANKLIN_GREETING);
  franklinSetState('idle');
}

// ------------------------------------------------------------ init

async function initFranklinChat() {
  const avatarImg = franklinEl('franklin-avatar-img');
  if (avatarImg) avatarImg.src = franklinAvatarSrc();

  if (franklinInitDone) return;
  franklinInitDone = true;

  franklinLoad();
  if (franklinHistory.length === 0) {
    // First open: Franklin greets first. The greeting is stored, so it
    // stays the first line of the thread — it is not re-sent every open.
    franklinAddMessage('model', FRANKLIN_GREETING);
    const avatar = franklinEl('franklin-avatar-img');
    if (avatar) {
      avatar.classList.add('welcoming');
      setTimeout(() => avatar.classList.remove('welcoming'), 2600);
    }
  } else {
    franklinRender();
  }

  const voiceButton = franklinEl('franklin-voice');
  if (voiceButton) {
    voiceButton.textContent = franklinVoiceOn ? 'Voice: On' : 'Voice: Off';
    voiceButton.classList.toggle('voice-on', franklinVoiceOn);
  }

  // Talk button reflects the saved preference (primed, not listening —
  // the mic needs a tap to start). View hooks stop the session when
  // Matt navigates away or the app goes to the background.
  franklinTalkSetButton();
  franklinInstallViewHooks();

  const input = franklinEl('franklin-input');
  if (input) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        sendFranklinMessage();
      }
    });
  }

  // Ask the Worker whether AI is configured. If it is not, the chat says
  // so plainly and Send is disabled until the key is set.
  try {
    const response = await fetch(FRANKLIN_AI_BASE + '/health', { method: 'GET' });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data && data.configured === false) {
      const sendButton = franklinEl('franklin-send');
      if (sendButton) sendButton.disabled = true;
      const status = franklinEl('franklin-status');
      if (status) status.textContent = 'AI not set up yet — the owner needs to set the API key.';
      franklinAddMessage('system', 'AI is not configured yet. The owner needs to set the API key before Franklin can answer.');
      return;
    }
    if (!response.ok) throw new Error('unreachable');
  } catch (e) {
    // Worker unreachable — leave Send enabled; the first send reports it.
  }
  franklinSetState('idle');
}
