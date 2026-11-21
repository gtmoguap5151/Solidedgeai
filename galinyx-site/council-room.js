/**
 * council-room.js — the QUIET Council Room (owner's order, Nov 20, 2026).
 *
 * A read-only window onto the written notes the five council members
 * pass each other through the Core's interaction layer, plus notes from
 * Xena as Director. It fetches the published snapshot
 * (council-room.json, built by
 * governance-core/tools/export-council-room.mjs) and renders it,
 * newest first. Nothing here generates, replies, acts, spends, or
 * publishes: there is no input, no send button, no live conversation.
 * The room refreshes only when the snapshot is re-published.
 */
(function () {
  'use strict';

  var loaded = false;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function kindLabel(kind) {
    // Plain English for the three Core message kinds.
    if (kind === 'ASK') return 'Ask';
    if (kind === 'HANDOFF') return 'Handoff';
    if (kind === 'NOTICE') return 'Notice';
    return kind || 'Note';
  }

  function noteHtml(note) {
    var when = '';
    try {
      when = new Date(note.timestamp).toLocaleString();
    } catch (e) {
      when = note.timestamp || '';
    }
    return '<div class="item"><div class="dot"></div><div style="flex:1;min-width:0">'
      + '<strong>' + escapeHtml(note.from) + ' → ' + escapeHtml(note.to)
      + ' <span class="badge">' + escapeHtml(kindLabel(note.kind)) + '</span></strong>'
      + '<small>' + escapeHtml(note.text) + '</small>'
      + '<small>' + escapeHtml(when) + '</small>'
      + '</div></div>';
  }

  function loadCouncilRoom() {
    var listEl = document.getElementById('council-room-list');
    var updatedEl = document.getElementById('council-room-updated');
    var countEl = document.getElementById('council-room-count');
    if (!listEl) return;
    if (!loaded) listEl.innerHTML = '<div class="empty">Loading…</div>';
    fetch('./council-room.json', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('council-room snapshot fetch failed: ' + res.status);
        return res.json();
      })
      .then(function (snap) {
        loaded = true;
        var notes = Array.isArray(snap.notes) ? snap.notes : [];
        if (updatedEl && snap.generatedAt) {
          try {
            updatedEl.textContent = 'snapshot from ' + new Date(snap.generatedAt).toLocaleString();
          } catch (e) {
            updatedEl.textContent = '';
          }
        }
        if (countEl) countEl.textContent = notes.length + (notes.length === 1 ? ' note' : ' notes');
        listEl.innerHTML = notes.length
          ? notes.map(noteHtml).join('')
          : '<div class="empty">No notes between council members yet. When one writes to another, it shows up here.</div>';
      })
      .catch(function () {
        listEl.innerHTML = '<div class="empty">The room could not be loaded. Check the connection and open the view again.</div>';
      });
  }

  window.loadCouncilRoom = loadCouncilRoom;
})();
