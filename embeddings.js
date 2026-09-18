/**
 * Word-neighbor hover: loads embeddings.json, cosine-sim on .w mouseenter.
 * No external deps. Serve via http (not file://) so fetch works.
 */
(function () {
  "use strict";

  var TOP_K = 8;
  var CLEAR_MS = 80;

  var words = null; // { key: Float32Array }
  var keys = [];
  var clearTimer = null;
  var hud = null;

  function cosine(a, b) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  function ensureHud() {
    if (hud) return hud;
    hud = document.createElement("aside");
    hud.id = "embed-hud";
    hud.className = "embed-hud";
    hud.setAttribute("aria-live", "polite");
    hud.innerHTML =
      '<div class="embed-hud-head">' +
      '<span class="mono-tag">[EMB]</span>' +
      '<span class="mono-tag faint" id="embed-hud-model">all-MiniLM-L6-v2</span>' +
      "</div>" +
      '<div class="embed-hud-query" id="embed-hud-query">hover a word</div>' +
      '<ol class="embed-hud-list" id="embed-hud-list"></ol>';
    document.body.appendChild(hud);
    return hud;
  }

  function clearHighlights() {
    var nodes = document.querySelectorAll(".w-active, .w-near");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.remove("w-active", "w-near");
    }
    var q = document.getElementById("embed-hud-query");
    var list = document.getElementById("embed-hud-list");
    if (q) q.textContent = "hover a word";
    if (list) list.innerHTML = "";
  }

  function neighborsFor(key) {
    var q = words[key];
    if (!q) return [];
    var scored = [];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === key) continue; // skip self — always cosine 1
      scored.push({ k: k, s: cosine(q, words[k]) });
    }
    scored.sort(function (a, b) {
      return b.s - a.s;
    });
    return scored.slice(0, TOP_K);
  }

  function highlight(key) {
    if (!words || !words[key]) return;
    clearHighlights();
    var ranked = neighborsFor(key);
    var nearSet = {};
    for (var i = 0; i < ranked.length; i++) {
      nearSet[ranked[i].k] = ranked[i].s;
    }

    var spans = document.querySelectorAll(".w");
    for (var j = 0; j < spans.length; j++) {
      var w = spans[j].getAttribute("data-w");
      if (w === key) {
        spans[j].classList.add("w-active");
      } else if (nearSet[w] !== undefined) {
        spans[j].classList.add("w-near");
      }
    }

    ensureHud();
    var qEl = document.getElementById("embed-hud-query");
    var list = document.getElementById("embed-hud-list");
    if (qEl) qEl.textContent = key;
    if (list) {
      var html = "";
      for (var r = 0; r < ranked.length; r++) {
        var item = ranked[r];
        var cls = item.k === key ? " is-self" : "";
        html +=
          "<li class='" +
          cls +
          "'><span class='emb-w'>" +
          item.k +
          "</span><span class='emb-s'>" +
          item.s.toFixed(3) +
          "</span></li>";
      }
      list.innerHTML = html;
    }
  }

  function onEnter(ev) {
    var t = ev.target;
    if (!t || !t.classList || !t.classList.contains("w")) return;
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }
    var key = t.getAttribute("data-w");
    highlight(key);
  }

  function onLeave(ev) {
    var t = ev.target;
    if (!t || !t.classList || !t.classList.contains("w")) return;
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(clearHighlights, CLEAR_MS);
  }

  function toF32(arr) {
    return Float32Array.from(arr);
  }

  function init(data) {
    words = {};
    keys = Object.keys(data.words);
    for (var i = 0; i < keys.length; i++) {
      words[keys[i]] = toF32(data.words[keys[i]]);
    }
    ensureHud();
    var modelEl = document.getElementById("embed-hud-model");
    if (modelEl && data.model) modelEl.textContent = data.model;

    document.body.addEventListener("mouseenter", onEnter, true);
    document.body.addEventListener("mouseleave", onLeave, true);
  }

  fetch("embeddings.json")
    .then(function (r) {
      if (!r.ok) throw new Error("embeddings.json " + r.status);
      return r.json();
    })
    .then(init)
    .catch(function (err) {
      console.warn("[embeddings]", err);
      ensureHud();
      var q = document.getElementById("embed-hud-query");
      if (q) q.textContent = "embeddings unavailable (serve over http)";
    });
})();
