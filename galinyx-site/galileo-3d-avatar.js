/**
 * galileo-3d-avatar.js — Galileo's MOVING 3D avatar (owner's order,
 * Nov 20, 2026, after he judged the Meshy head): the Meshy 6 Lite head,
 * rigged with baked morph targets (jawOpen + blink) by
 * brand/3d/bake_morphs.py, rendered live with Three.js. It blinks, its
 * jaw follows his speech (the same speechSynthesis word-boundary events
 * the 2D avatar already uses), and the head sways, nods and breathes.
 *
 * Progressive enhancement: the 2D canvas avatar (galileo-live-avatar.js)
 * shows until the 3D head has loaded, and if anything fails here — no
 * WebGL, CDN blocked, GLB unreachable — this module removes its canvas
 * and the 2D avatar carries on untouched. The GLB is ~5.5 MB; the 2D
 * avatar covers the load, and the file is cached immutably after the
 * first download (versioned filename: a re-bake gets a new URL).
 *
 * Three.js 0.160.0 comes from the import map in index.html (jsdelivr,
 * pinned — the same CDN the shell already uses for Supabase). The GLB
 * is hosted on Cloudflare Pages (galinyx-3d.pages.dev) with CORS open,
 * because the GitHub connector rejects binaries (see
 * brand/3d/upload_pages.py). The render loop is throttled to ~30 fps,
 * no shadows, no post-processing — the target device is a moto g 2025.
 *
 * When the 3D head is live, window.__galileo3dLive is true and the 2D
 * avatar yields (it checks the flag before taking over). If 3D fails
 * after takeover (e.g. WebGL context lost) the flag is cleared and the
 * 2D canvas is unhidden again.
 */
(function () {
  'use strict';

  var GLB_URL = 'https://galinyx-3d.pages.dev/galileo-head-v1.glb';
  var FRAME_MS = 33; // ~30 fps

  var canvas = null, img = null, video = null, canvas2d = null;
  var live = false;      // 3D head on screen
  var started = false;   // load attempted (once)
  var renderer = null, scene = null, camera = null, rig = null, headMesh = null;
  var jawIdx = -1, blinkIdx = -1;
  var jaw = 0, jawTarget = 0, blink = 0;
  var lastFrame = 0, bufW = 0, bufH = 0;
  var state = { speaking: false, thinking: false, listening: false };
  var speech = { lastBoundary: 0, fallbackUntil: 0 };
  var blinkAt = 0, blinkPhase = 0, blinkStart = 0; // 0 idle, 1 closing, 2 hold, 3 opening
  var callWatchInstalled = false;

  function el(id) { return document.getElementById(id); }
  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

  function fail(reason) {
    // Graceful: drop the 3D canvas, let the 2D avatar carry on.
    if (window.console && console.warn) console.warn('[galileo-3d] unavailable:', reason);
    live = false;
    window.__galileo3dLive = false;
    if (canvas && canvas.parentElement) canvas.parentElement.removeChild(canvas);
    canvas = null;
    if (renderer) { try { renderer.dispose(); } catch (e) { /* already gone */ } renderer = null; }
  }

  function ensureCanvas() {
    canvas = document.createElement('canvas');
    canvas.id = 'galileo-avatar-3d';
    canvas.className = 'chat-avatar hidden';
    canvas.title = 'Galileo — tap to talk';
    canvas.setAttribute('aria-label', 'Galileo, 3D avatar — tap to talk');
    canvas.addEventListener('click', function () {
      if (typeof window.galileoTap === 'function') window.galileoTap();
    });
    img.parentElement.insertBefore(canvas, img);
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      fail('WebGL context lost');
      // Hand the avatar back to the 2D canvas.
      var c2 = el('galileo-avatar-canvas');
      if (c2) c2.classList.remove('hidden');
    }, false);
  }

  // --- speech hook: jaw follows Galileo's words (same events as 2D) ---
  function wrapSpeech() {
    if (!window.speechSynthesis || window.__galileo3dWrapped) return;
    window.__galileo3dWrapped = true;
    var nativeSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = function (utter) {
      try {
        if (utter && !utter.__galileo3dWrapped) {
          utter.__galileo3dWrapped = true;
          var isGalileo = !utter.pitch || utter.pitch < 1.1;
          if (isGalileo) {
            speech.fallbackUntil = Date.now() + Math.max(1200, (utter.text || '').length * 55);
            utter.addEventListener('boundary', function (ev) {
              if (ev.name === 'word' || !ev.name) {
                speech.lastBoundary = Date.now();
                jawTarget = 0.45 + Math.random() * 0.55;
              }
            });
            utter.addEventListener('end', function () { jawTarget = 0; });
            utter.addEventListener('error', function () { jawTarget = 0; });
          }
        }
      } catch (e) { /* speech hook must never break speech */ }
      return nativeSpeak(utter);
    };
  }

  // --- state mirror: same speaking/thinking/listening classes as 2D ---
  function mirrorState() {
    if (!canvas) return;
    var s = (img && img.classList.contains('speaking')) || (video && video.classList.contains('speaking'));
    var t = (img && img.classList.contains('thinking')) || (video && video.classList.contains('thinking'));
    var l = (img && img.classList.contains('listening')) || (video && video.classList.contains('listening'));
    state.speaking = s; state.thinking = t; state.listening = l;
    ['speaking', 'thinking', 'listening'].forEach(function (cls) {
      canvas.classList.toggle(cls, !!state[cls]);
    });
    if (live && canvas.classList.contains('hidden')) canvas.classList.remove('hidden');
    if (!s) jawTarget = 0;
  }

  function watchState() {
    if (!('MutationObserver' in window)) return;
    var obs = new MutationObserver(mirrorState);
    [img, video].forEach(function (n) {
      if (n) obs.observe(n, { attributes: true, attributeFilter: ['class'] });
    });
  }

  // --- call screen: if the 3D head goes live mid-call, ride up ---
  function installCallWatch() {
    if (callWatchInstalled) return;
    var callEl = el('galileo-call');
    if (!callEl || !('MutationObserver' in window)) return;
    callWatchInstalled = true;
    new MutationObserver(function () {
      // Call screen closed: if this canvas is still on it, move it home.
      // (galileo-chat.js normally moves it home itself; this is the
      // backstop for the mid-call takeover below.)
      if (!callEl.classList.contains('open') && canvas) {
        var slot = el('galileo-call-avatar');
        if (slot && canvas.parentElement === slot && img && img.parentElement) {
          img.parentElement.insertBefore(canvas, img);
        }
      }
    }).observe(callEl, { attributes: true, attributeFilter: ['class'] });
  }

  function takeOver() {
    live = true;
    window.__galileo3dLive = true;
    if (img) img.classList.add('hidden');
    if (video) { video.classList.add('hidden'); video.pause(); }
    canvas2d = el('galileo-avatar-canvas');
    if (canvas2d) canvas2d.classList.add('hidden');
    canvas.classList.remove('hidden');
    mirrorState();
    blinkAt = Date.now() + 1200 + Math.random() * 2000;

    // Mid-call takeover: the Talk screen is open and the 2D canvas is
    // riding on it — the 3D head rides up too, so the call screen is
    // never left showing a hidden canvas. (No inline style: the call
    // screen sizes .chat-avatar itself, same as the 2D canvas.)
    var callEl = el('galileo-call');
    var slot = el('galileo-call-avatar');
    if (callEl && callEl.classList.contains('open') && slot &&
        canvas2d && canvas2d.parentElement === slot) {
      slot.appendChild(canvas);
    }
    requestAnimationFrame(frame);
  }

  // --- Three.js setup ---
  function frameHead(mesh, THREE) {
    // Frame head + beard + upper shoulders; crop the shoulder base so
    // the face fills the circular avatar. Landmarks (measured from the
    // mesh): crown y 0.947, beard to y -0.10, face points +Z.
    var box = new THREE.Box3().setFromObject(mesh);
    var top = box.max.y;
    var span = Math.min(box.max.y - box.min.y, 1.10);
    var centerY = top - span / 2;
    var centerZ = (box.max.z + box.min.z) / 2;
    var dist = (span / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.04;
    camera.position.set(0, centerY, centerZ + dist);
    camera.lookAt(0, centerY, centerZ);
  }

  function buildScene(THREE) {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);

    // Warm key light from the front-right, cool rim from the back-left,
    // soft hemisphere fill — a clay bust needs shape, not glare.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a68, 1.05));
    var key = new THREE.DirectionalLight(0xfff1de, 1.7);
    key.position.set(1.6, 1.4, 2.4);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0xbfd4ff, 0.8);
    rim.position.set(-2.2, 1.0, -1.8);
    scene.add(rim);
    var fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-1.2, 0.2, 2.0);
    scene.add(fill);

    rig = new THREE.Group();
    scene.add(rig);
  }

  function load() {
    if (started) return;
    started = true;
    // Respect Data Saver — a 5.5 MB model is not worth it on a metered link.
    if (navigator.connection && navigator.connection.saveData) {
      fail('Data Saver on — 2D avatar kept');
      return;
    }
    ensureCanvas();
    wrapSpeech();
    watchState();
    installCallWatch();

    import('three').then(function (THREE) {
      return import('three/addons/loaders/GLTFLoader.js').then(function (mod) {
        return { THREE: THREE, GLTFLoader: mod.GLTFLoader };
      });
    }).then(function (libs) {
      var THREE = libs.THREE;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas: canvas, antialias: true, alpha: true,
          powerPreference: 'low-power'
        });
      } catch (e) {
        fail('WebGL unavailable: ' + (e && e.message));
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      buildScene(THREE);

      var loader = new libs.GLTFLoader();
      loader.load(GLB_URL, function (gltf) {
        gltf.scene.traverse(function (obj) {
          if (obj.isMesh && !headMesh) headMesh = obj;
        });
        if (!headMesh) { fail('GLB has no mesh'); return; }
        var dict = headMesh.morphTargetDictionary || {};
        jawIdx = ('jawOpen' in dict) ? dict.jawOpen : -1;
        blinkIdx = ('blink' in dict) ? dict.blink : -1;
        if (jawIdx < 0 || blinkIdx < 0) {
          if (window.console && console.warn) {
            console.warn('[galileo-3d] morph targets missing — sway only');
          }
        }
        rig.add(headMesh);
        frameHead(headMesh, THREE);
        takeOver();
      }, undefined, function (err) {
        fail('GLB load failed: ' + (err && (err.message || err)));
      });
    }).catch(function (err) {
      fail('Three.js load failed: ' + (err && (err.message || err)));
    });
  }

  // --- animation loop ---
  function frame(now) {
    if (!live) return;
    requestAnimationFrame(frame);
    if (document.hidden) return;
    if (!canvas || canvas.offsetParent === null) return; // view hidden
    if (now - lastFrame < FRAME_MS) return;
    var dt = Math.min(0.1, (now - lastFrame) / 1000 || 0.033);
    lastFrame = now;

    // Resize to the canvas's displayed size (chat avatar 64px, call
    // screen up to ~340px — same renderer, same framing).
    var w = canvas.clientWidth || 64, h = canvas.clientHeight || 64;
    if (w !== bufW || h !== bufH) {
      bufW = w; bufH = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    // Jaw: boundary events pump the target; it decays fast between words.
    // If no boundary events arrive (some voices never fire them), the
    // syllable fallback keeps the jaw moving while he speaks.
    if (state.speaking) {
      if (now - speech.lastBoundary > 700 && now < speech.fallbackUntil) {
        jawTarget = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(now * 0.028));
      } else if (now - speech.lastBoundary > 140) {
        jawTarget *= Math.pow(0.5, dt / 0.09);
      }
    } else {
      jawTarget = 0;
    }
    jaw += (jawTarget - jaw) * Math.min(1, dt * 16);
    if (jawIdx >= 0) headMesh.morphTargetInfluences[jawIdx] = jaw;

    // Blink: close 70ms, hold 50ms, open 140ms, every ~3–6.5s.
    if (blinkPhase === 0 && now >= blinkAt) { blinkPhase = 1; blinkStart = now; }
    if (blinkPhase === 1) {
      blink = smooth((now - blinkStart) / 70);
      if (now - blinkStart >= 70) { blinkPhase = 2; blinkStart = now; }
    } else if (blinkPhase === 2) {
      blink = 1;
      if (now - blinkStart >= 50) { blinkPhase = 3; blinkStart = now; }
    } else if (blinkPhase === 3) {
      blink = 1 - smooth((now - blinkStart) / 140);
      if (now - blinkStart >= 140) {
        blinkPhase = 0; blink = 0;
        blinkAt = now + 2600 + Math.random() * 3900;
      }
    }
    if (blinkIdx >= 0) headMesh.morphTargetInfluences[blinkIdx] = blink;

    // Idle life: slow sway, a thinking tilt, breathing, a small nod
    // while he speaks. The rig pivots at y=0 — the neck — so the head
    // turns on the neck, not the chin.
    var t = now / 1000;
    rig.rotation.y = 0.055 * Math.sin(t * 0.7) + 0.035 * Math.sin(t * 0.19 + 1.7);
    rig.rotation.x = 0.022 * Math.sin(t * 1.07 + 0.6) +
      (state.thinking ? 0.035 : 0) +
      (state.speaking ? 0.012 * Math.sin(t * 4.4) * Math.min(1, jaw * 2) : 0);
    rig.rotation.z = 0.010 * Math.sin(t * 0.43 + 2.1) + (state.listening ? 0.02 : 0);
    var breath = Math.sin(t * 1.4);
    rig.position.y = 0.006 * breath;
    rig.scale.setScalar(1 + 0.005 * Math.sin(t * 1.4 + 0.8));

    renderer.render(scene, camera);
  }

  img = el('galileo-avatar-img');
  video = el('galileo-avatar-video');
  if (img) load();
})();
