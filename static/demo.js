/* Shared by every page that remembers something for this visitor.
 *
 * Everything the demo "saves" lives in this browser's localStorage, under one
 * prefix. Every read and write is wrapped: in a private window, or with
 * storage blocked, the site still works, it just forgets on reload.
 */
var Demo = (function () {
  "use strict";
  var PREFIX = "ltdemo.";

  function load(key, fallback) {
    try {
      var raw = window.localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function reset() {
    try {
      Object.keys(window.localStorage)
        .filter(function (k) { return k.indexOf(PREFIX) === 0; })
        .forEach(function (k) { window.localStorage.removeItem(k); });
    } catch (e) { /* nothing saved, nothing to clear */ }
  }

  // --- following bills: { id: true } -----------------------------------------
  function follows() { return load("follows", {}); }

  function isFollowing(id) { return Object.prototype.hasOwnProperty.call(follows(), id); }

  function setFollowing(id, on) {
    var all = follows();
    if (on) { all[id] = true; } else { delete all[id]; }
    save("follows", all);
  }

  function drawFollow(button) {
    var on = isFollowing(button.dataset.follow);
    button.classList.toggle("on", on);
    button.textContent = on ? "Stop watching" : "Watch this bill";
    button.setAttribute("aria-pressed", on ? "true" : "false");
  }

  // One listener for every follow button, including ones drawn later.
  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-follow]");
    if (!button) { return; }
    setFollowing(button.dataset.follow, !isFollowing(button.dataset.follow));
    document.querySelectorAll('[data-follow="' + button.dataset.follow + '"]').forEach(function (b) {
      drawFollow(b);
      replay(b, "swap");
    });
  });

  // Restart a one-shot CSS animation on an element, e.g. a label that changed.
  function replay(el, name) {
    el.classList.remove(name);
    void el.offsetWidth;
    el.classList.add(name);
  }

  function drawAllFollows(root) {
    (root || document).querySelectorAll("[data-follow]").forEach(drawFollow);
  }

  // --- the title rule shared by categories and priority words ---------------
  // Starts a word; four letters or fewer must be the whole word. The same rule
  // as tracker/matching.py, which the build uses.
  function matches(phrase, title) {
    var p = phrase.trim().toLowerCase();
    if (!p) { return false; }
    var escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var whole = p.replace(/ /g, "").length <= 4 ? "(?![\\p{L}\\p{N}_])" : "";
    return new RegExp("(?<![\\p{L}\\p{N}_])" + escaped + whole, "iu").test(title || "");
  }

  // --- categories edited on Settings redraw every bill's chips -----------------
  function categoryNames(title, categories) {
    return categories
      .filter(function (c) { return c.keywords.some(function (k) { return matches(k, title); }); })
      .map(function (c) { return c.name; });
  }

  function drawCategories(root) {
    var saved = load("categories", null);
    if (!saved) { return; }
    (root || document).querySelectorAll(".cat-chips[data-cats-for]").forEach(function (box) {
      var manual = box.dataset.manual ? box.dataset.manual.split("|") : null;
      var names = manual || categoryNames(box.dataset.title, saved);
      box.querySelectorAll(".cat-chip").forEach(function (chip) { chip.remove(); });
      var how = box.querySelector(".cat-how");
      (names.length ? names : ["Uncategorised"]).forEach(function (name) {
        var chip = document.createElement("span");
        chip.className = "cat-chip" + (names.length ? "" : " none");
        chip.textContent = name;
        box.insertBefore(chip, how);
      });
      var row = box.closest("[data-cats]");
      if (row) { row.dataset.cats = "|" + (names.length ? names.join("|") : "Uncategorised") + "|"; }
    });
    var pick = document.querySelector("select#category");
    if (pick) {
      var chosen = pick.value;
      pick.querySelectorAll("option:not([value=''])").forEach(function (o) { o.remove(); });
      saved.map(function (c) { return c.name; }).concat(["Uncategorised"]).forEach(function (name) {
        var o = document.createElement("option");
        o.value = o.textContent = name;
        pick.appendChild(o);
      });
      pick.value = chosen;
    }
  }

  // --- the change history, newest last ------------------------------------------
  function record(area, what) {
    var all = load("history", []);
    var now = new Date();
    var clock = ((now.getHours() + 11) % 12 + 1) + ":" + String(now.getMinutes()).padStart(2, "0") +
      (now.getHours() < 12 ? "am" : "pm");
    all.push({ when: "Thu 1 Oct, " + clock, who: "User A (you)", area: area, what: what });
    save("history", all);
  }

  document.addEventListener("click", function (event) {
    if (!event.target.closest("[data-reset]")) { return; }
    reset();
    window.location.reload();
  });

  drawAllFollows();
  drawCategories();

  return { load: load, save: save, reset: reset, follows: follows, isFollowing: isFollowing,
           drawAllFollows: drawAllFollows, matches: matches, categoryNames: categoryNames,
           drawCategories: drawCategories, record: record, replay: replay };
})();
