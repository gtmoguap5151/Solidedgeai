/**
 * galileo-live-avatar.js — Galileo's LIVE avatar: a real-time talking head.
 *
 * Matt's order, Nov 20, 2026: "I want a full moving avatar, not a
 * portrait, not video clips. Actual movements... Just like you." The
 * pre-rendered 10s loops (galileo-avatar-video.js) are what he rejected
 * as generic, so this replaces them as the presence avatar: the same
 * v2 Ferraris portrait (GALILEO_AVATAR), drawn on a canvas every frame
 * with live motion — blinking, breathing, subtle head sway and tilt,
 * and a jaw that opens and closes with his actual speech.
 *
 * HONEST LIMITS — read before promising more:
 * 1. This is a live 2D animated portrait, not a 3D rig and not the
 *    Muse platform's live-avatar tech. The head never turns to a new
 *    angle and the face never reshapes; the movement is blink, breath,
 *    sway, tilt, and jaw. That is the most a static page can honestly
 *    do with a single portrait and $0.
 * 2. The mouth is driven by the speech itself, but NOT by a Web Audio
 *    analyser: browser speechSynthesis audio cannot be routed into an
 *    AnalyserNode in any browser — there is no API for it. Instead this
 *    file wraps speechSynthesis.speak and reads each utterance's
 *    onboundary word events (fired by Chrome as each word is spoken),
 *    so the jaw opens and closes on the real word timing. If a voice
 *    fires no boundary events, a syllable-rate fallback clock drives
 *    the jaw while the utterance is speaking. The jaw is never a
 *    pre-baked loop; it follows the words being spoken, live.
 * 3. The stage is the existing 64px presence circle in chat — and the
 *    big call screen when Talk is active (galileo-chat.js moves this
 *    same canvas onto it; the backing store is 512px so the big stage
 *    stays crisp). The movement is visible at both sizes.
 *
 * Wiring: this file is ADDITIVE. It does not edit galileo-chat.js,
 * galileo-avatar.js, or galileo-avatar-video.js. It loads after the
 * avatar files and before galileo-chat.js, inserts a canvas beside the
 * still portrait, and takes over the presence slot when the portrait
 * image has loaded. Chat state (listening / thinking / speaking) is
 * read with a MutationObserver on the portrait/video elements' classes
 * — the chat code never has to know this file exists. If anything
 * fails (no portrait, no canvas, image error), the canvas never shows
 * and the video loops / still portrait carry on exactly as before.
 */

(function () {
  'use strict';

  // Landmarks in the v2 portrait (GALILEO_AVATAR, 1600x1600), in
  // 0-1000 normalized coordinates, verified by visual grounding
  // Nov 20, 2026 and checked against a marked-up copy of the image:
  // eyes (384,361) and (522,360); mouth centre (440,518); the mouth
  // sits under the moustache with the lips just visible.
  var EYE_L = { x: 384, y: 361, rx: 37, ry: 15 };
  var EYE_R = { x: 522, y: 360, rx: 37, ry: 15 };
  var MOUTH = { x: 440, y: 518, rx: 40, ryMax: 14 };
  // Forehead + glabella sample points for the eyelid skin tone
  // (sampled Nov 20, 2026: forehead (229,176,126), glabella
  // (209,146,97) — the points directly above the eyes hit the brow,
  // and the cheek point sits in warm shadow, so neither is used).
  var SKIN_A = { x: 452, y: 285 };
  var SKIN_B = { x: 452, y: 335 };

  var CANVAS_SIZE = 512;   // backing store (CSS shows it at 64px in
                           // chat, up to 360px on the call screen)
  var OVERSCAN = 1.08;     // image drawn slightly oversized so head
                           // rotation never reveals the canvas edge
  var FRAME_MS = 33;       // ~30fps — smooth enough, kind to battery

  var canvas = null;
  var ctx = null;
  var portrait = null;
  var live = false;        // true once the canvas has taken over
  var rafId = 0;
  var lastFrame = 0;

  // Skin tones sampled from the portrait at load; warm olive fallbacks.
  var skinTop = '#e5b07e';
  var skinBottom = '#d19261';

  // Animation state.
  var jaw = 0;             // 0 closed .. 1 fully open (smoothed)
  var jawTarget = 0;
  var speakingLevel = 0;   // 0 silent .. 1 speaking (smoothed)
  var blinkAt = 0;         // next scheduled blink (performance.now ms)
  var blinkStart = -1;     // blink in progress, or -1
  var avatarState = 'idle'; // idle | listening | thinking | speaking

  // Speech tracking (see the header note on boundary events).
  var speechStartAt = 0;
  var lastBoundaryAt = 0;
  var boundarySeen = false;
  var boundaryFallback = false;

  function $(id) { return document.getElementById(id); }

  // Map a 0-1000 landmark coordinate into canvas pixels, accounting
  // for the overscan zoom (the image is drawn centred at 1.08x).
  function LX(x) { return (x / 1000 - 0.5) * OVERSCAN * CANVAS_SIZE + CANVAS_SIZE / 2; }
  function LY(y) { return (y / 1000 - 0.5) * OVERSCAN * CANVAS_SIZE + CANVAS_SIZE / 2; }
  function LS(v) { return v / 1000 * OVERSCAN * CANVAS_SIZE; }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }

  // ------------------------------------------------------------ speech hook
  //
  // Wraps speechSynthesis.speak so every utterance's boundary events
  // drive the jaw. Existing onstart/onend/onerror/onboundary handlers
  // are chained, never replaced — the chat's turn-taking still works.
  // Galileo speaks at pitch 0.9, Xena at 1.3 (galileo-chat.js), so
  // pitch < 1.1 identifies Galileo's utterances; Xena's lines never
  // move Galileo's mouth.

  function hookSpeech() {
    try {
      if (!('speechSynthesis' in window)) return;
      var synth = window.speechSynthesis;
      if (synth.__galileoLiveWrapped) return;
      var origSpeak = synth.speak.bind(synth);
      synth.speak = function (utterance) {
        try {
          var isGalileo = !utterance || typeof utterance.pitch !== 'number' || utterance.pitch < 1.1;
          if (isGalileo) {
            var prevStart = utterance.onstart;
            var prevEnd = utterance.onend;
            var prevError = utterance.onerror;
            var prevBoundary = utterance.onboundary;
            utterance.onstart = function (ev) {
              speechStartAt = performance.now();
              lastBoundaryAt = 0;
              boundarySeen = false;
              boundaryFallback = false;
              if (prevStart) prevStart.call(this, ev);
            };
            utterance.onend = function (ev) {
              speakingLevel = 0;
              jawTarget = 0;
              if (prevEnd) prevEnd.call(this, ev);
            };
            utterance.onerror = function (ev) {
              speakingLevel = 0;
              jawTarget = 0;
              if (prevError) prevError.call(this, ev);
            };
            utterance.onboundary = function (ev) {
              // A word boundary: open the jaw for this word. Longer
              // words stay open wider; a little randomness keeps it
              // from looking mechanical.
              boundarySeen = true;
              boundaryFallback = false;
              lastBoundaryAt = performance.now();
              var len = ev && typeof ev.charLength === 'number' ? ev.charLength : 4;
              jawTarget = clamp(0.45 + Math.min(len, 12) * 0.045 + Math.random() * 0.2, 0, 1);
              if (prevBoundary) prevBoundary.call(this, ev);
            };
          }
        } catch (e) { /* never break speech — the jaw just stays still */ }
        return origSpeak(utterance);
      };
      synth.__galileoLiveWrapped = true;
    } catch (e) { /* speech hook unavailable — blinks and breath still run */ }
  }

  // ------------------------------------------------------------ state mirror
  //
  // The chat puts listening/thinking/speaking classes on the portrait
  // img or the video element. Watch both, mirror the state onto the
  // canvas (so the CSS glow/pulse still shows), and re-hide the img and
  // video while the live canvas owns the slot — initGalileoChat runs
  // later, when the view opens, and would otherwise un-hide the video.

  var STATE_CLASSES = ['listening', 'thinking', 'speaking', 'welcoming'];

  function readStateFromDom() {
    var classes = '';
    var img = $('galileo-avatar-img');
    var video = $('galileo-avatar-video');
    if (img) classes += ' ' + img.className;
    if (video) classes += ' ' + video.className;
    if (classes.indexOf('speaking') !== -1) return 'speaking';
    if (classes.indexOf('thinking') !== -1) return 'thinking';
    if (classes.indexOf('listening') !== -1) return 'listening';
    return 'idle';
  }

  function mirrorState() {
    avatarState = readStateFromDom();
    if (!canvas) return;
    for (var i = 0; i < STATE_CLASSES.length; i++) {
      canvas.classList.remove(STATE_CLASSES[i]);
    }
    if (avatarState !== 'idle') canvas.classList.add(avatarState);
    var img = $('galileo-avatar-img');
    if (img && img.className.indexOf('welcoming') !== -1) canvas.classList.add('welcoming');
    // Re-assert the takeover: the chat may have un-hidden the video.
    if (live) takeOver(true);
  }

  function takeOver(quiet) {
    // The 3D head owns the avatar once it is live — this canvas yields
    // (galileo-3d-avatar.js sets window.__galileo3dLive on takeover).
    // If 3D ever fails after takeover it clears the flag and unhides
    // this canvas itself, so the 2D avatar resumes without a reload.
    if (window.__galileo3dLive) return;
    var img = $('galileo-avatar-img');
    var video = $('galileo-avatar-video');
    if (img) img.classList.add('hidden');
    if (video) {
      video.classList.add('hidden');
      try { video.pause(); } catch (e) { /* ignore */ }
    }
    if (canvas) canvas.classList.remove('hidden');
    if (!quiet) live = true;
  }

  function installStateObserver() {
    try {
      if (!('MutationObserver' in window)) return;
      var observer = new MutationObserver(function () { mirrorState(); });
      var img = $('galileo-avatar-img');
      var video = $('galileo-avatar-video');
      if (img) observer.observe(img, { attributes: true, attributeFilter: ['class'] });
      if (video) observer.observe(video, { attributes: true, attributeFilter: ['class'] });
    } catch (e) { /* state stays idle — the avatar still blinks and breathes */ }
  }

  // ------------------------------------------------------------ skin sampling

  function sampleSkin() {
    try {
      var off = document.createElement('canvas');
      off.width = portrait.naturalWidth || portrait.width;
      off.height = portrait.naturalHeight || portrait.height;
      var octx = off.getContext('2d');
      if (!octx) return;
      octx.drawImage(portrait, 0, 0);
      var w = off.width, h = off.height;
      function pick(p) {
        var d = octx.getImageData(
          Math.floor(p.x / 1000 * w), Math.floor(p.y / 1000 * h), 1, 1
        ).data;
        return 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')';
      }
      skinTop = pick(SKIN_A);
      skinBottom = pick(SKIN_B);
    } catch (e) { /* keep the fallback tones */ }
  }

  // ------------------------------------------------------------ drawing

  function drawEyeLid(eye, closure) {
    if (closure <= 0.01) return;
    var cx = LX(eye.x);
    var cy = LY(eye.y);
    var rx = LS(eye.rx);
    var ry = LS(eye.ry);
    // The lid descends from the top of the eye: its centre drops and
    // its height grows as closure goes 0 -> 1.
    var lidCy = cy - ry + ry * closure;
    var lidRy = Math.max(ry * closure, 0.5);
    // Soft halo first so the edge does not look pasted on.
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = skinBottom;
    ctx.beginPath();
    ctx.ellipse(cx, lidCy, rx + 1.5, lidRy + 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    var grad = ctx.createLinearGradient(0, lidCy - lidRy, 0, lidCy + lidRy);
    grad.addColorStop(0, skinTop);
    grad.addColorStop(1, skinBottom);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, lidCy, rx, lidRy, 0, 0, Math.PI * 2);
    ctx.fill();
    // Lash line along the lid's lower edge when fully closed.
    if (closure > 0.85) {
      ctx.strokeStyle = 'rgba(40,25,15,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, lidCy, rx * 0.95, lidRy, 0, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }

  function drawMouth() {
    if (jaw < 0.08) return; // closed: the painted lips stand as-is
    var cx = LX(MOUTH.x);
    var cy = LY(MOUTH.y) + jaw * LS(4); // the jaw drops as it opens
    var rx = LS(MOUTH.rx) * (0.85 + 0.15 * jaw);
    var ry = LS(MOUTH.ryMax) * jaw;
    var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    grad.addColorStop(0, '#1d0a08');
    grad.addColorStop(0.7, '#2c100d');
    grad.addColorStop(1, '#3d1410');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, Math.max(ry, 0.6), 0, 0, Math.PI * 2);
    ctx.fill();
    // Faint shadow under the lower lip, for depth.
    ctx.strokeStyle = 'rgba(20,8,6,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy + ry * 0.9, rx * 0.9, Math.max(ry * 0.5, 0.5), 0, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }

  function drawFrame(now) {
    var t = now / 1000;

    // --- jaw: ease toward the target, with a syllable flutter while
    // speaking so the mouth keeps moving between word boundaries.
    var speaking = avatarState === 'speaking';
    if (speaking) {
      speakingLevel += (1 - speakingLevel) * 0.25;
      if (!boundarySeen && speechStartAt && now - speechStartAt > 700) {
        boundaryFallback = true; // this voice fires no boundary events
      }
      if (boundaryFallback) {
        jawTarget = 0.55 + 0.35 * Math.sin(t * Math.PI * 2 * 3.7 + Math.sin(t * 9.1) * 0.8);
      } else if (boundarySeen && lastBoundaryAt && now - lastBoundaryAt > 450) {
        jawTarget = 0.15; // between words the mouth mostly closes
      }
      var flutter = 0.22 * Math.sin(t * Math.PI * 2 * 4.2) * speakingLevel;
      var target = clamp(jawTarget + flutter, 0, 1);
      jaw += (target - jaw) * (target > jaw ? 0.45 : 0.22);
    } else {
      speakingLevel += (0 - speakingLevel) * 0.2;
      jawTarget = 0;
      jaw += (0 - jaw) * 0.25;
    }

    // --- blink: random every 2.8–6.5s; close 70ms, hold 40ms, open 130ms.
    if (blinkAt === 0) blinkAt = now + rand(1800, 4500);
    var closure = 0;
    if (blinkStart < 0 && now >= blinkAt) blinkStart = now;
    if (blinkStart >= 0) {
      var dt = now - blinkStart;
      if (dt < 70) closure = dt / 70;
      else if (dt < 110) closure = 1;
      else if (dt < 240) closure = 1 - (dt - 110) / 130;
      else {
        closure = 0;
        blinkStart = -1;
        blinkAt = now + rand(2800, 6500);
      }
      closure = clamp(closure, 0, 1);
      closure = closure * closure * (3 - 2 * closure); // smoothstep
    }

    // --- head: breathing scale, slow sway, and a slight tilt while
    // thinking; a small lean-in while listening.
    var breath = 1 + 0.006 * Math.sin(t * Math.PI * 2 * 0.22);
    var swayX = Math.sin(t * Math.PI * 2 * 0.11) * LS(2.2)
      + Math.sin(t * Math.PI * 2 * 0.031 + 1.7) * LS(1.2);
    var swayY = Math.sin(t * Math.PI * 2 * 0.17 + 0.6) * LS(1.8);
    var tilt = Math.sin(t * Math.PI * 2 * 0.09 + 2.2) * 0.008
      + Math.sin(t * Math.PI * 2 * 0.043) * 0.005;
    if (avatarState === 'thinking') tilt += 0.016;
    var lean = avatarState === 'listening' ? 1.008 : 1;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.save();
    ctx.translate(CANVAS_SIZE / 2 + swayX, CANVAS_SIZE / 2 + swayY);
    ctx.rotate(tilt);
    ctx.scale(breath * lean, breath * lean);
    ctx.translate(-CANVAS_SIZE / 2, -CANVAS_SIZE / 2);
    var over = (OVERSCAN - 1) / 2 * CANVAS_SIZE;
    ctx.drawImage(portrait, -over, -over, CANVAS_SIZE + over * 2, CANVAS_SIZE + over * 2);
    // Lids and mouth are drawn inside the same transform, so they
    // track the head exactly.
    drawEyeLid(EYE_L, closure);
    drawEyeLid(EYE_R, closure);
    drawMouth();
    ctx.restore();
  }

  function frame(now) {
    if (!live) return;
    rafId = requestAnimationFrame(frame);
    if (now - lastFrame < FRAME_MS) return;
    lastFrame = now;
    // Skip drawing while the tab or the Galileo view is hidden.
    if (document.hidden) return;
    if (canvas && !canvas.offsetParent && !document.hidden) {
      // offsetParent is null when the view is display:none — but also
      // when the canvas itself is position:fixed; the avatar is not,
      // so this is a safe visibility check. Still draw once a second
      // so a layout quirk never freezes the avatar silently.
      if (now % 1000 > FRAME_MS) return;
    }
    try {
      drawFrame(now);
    } catch (e) {
      // A drawing error must never spin the loop — stop the live
      // avatar and hand the slot back to the video / still.
      live = false;
      cancelAnimationFrame(rafId);
      var img = $('galileo-avatar-img');
      var video = $('galileo-avatar-video');
      if (canvas) canvas.classList.add('hidden');
      if (video && video.dataset.loop) {
        video.classList.remove('hidden');
      } else if (img) {
        img.classList.remove('hidden');
      }
    }
  }

  // ------------------------------------------------------------ init

  function init() {
    try {
      if (!('GALILEO_AVATAR' in window) || typeof GALILEO_AVATAR !== 'string' || !GALILEO_AVATAR) {
        return; // no portrait — the still / video carry on
      }
      var img = $('galileo-avatar-img');
      if (!img || !img.parentNode) return;
      if ($('galileo-avatar-canvas')) return; // already installed

      canvas = document.createElement('canvas');
      canvas.id = 'galileo-avatar-canvas';
      canvas.className = 'chat-avatar hidden';
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      canvas.title = 'Tap to say hello';
      canvas.setAttribute('onclick', 'galileoTap()');
      canvas.setAttribute('aria-label', 'Galileo Ferraris — live avatar');
      ctx = canvas.getContext('2d');
      if (!ctx) return;
      img.parentNode.insertBefore(canvas, img);

      portrait = new Image();
      portrait.onload = function () {
        try {
          sampleSkin();
          hookSpeech();
          installStateObserver();
          mirrorState();
          live = true;
          takeOver(false);
          lastFrame = performance.now();
          rafId = requestAnimationFrame(frame);
          document.addEventListener('visibilitychange', function () {
            // On return to the tab, restart the loop if it stopped.
            if (!document.hidden && live && !rafId) {
              lastFrame = performance.now();
              rafId = requestAnimationFrame(frame);
            }
          });
        } catch (e) {
          if (canvas) canvas.classList.add('hidden');
          live = false;
        }
      };
      portrait.onerror = function () {
        // The portrait did not load — remove the canvas; the still
        // and the video loops are untouched and carry on.
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
        canvas = null;
        live = false;
      };
      portrait.src = GALILEO_AVATAR;
    } catch (e) { /* never break the chat — the old avatar carries on */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
