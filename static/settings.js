/* The Settings screens, kept in this browser.
 *
 * Each section is checked in full before anything is saved. A value that
 * cannot be used is refused with the reason, and nothing in that section
 * changes; nothing is ever clamped into range quietly. Every save that changes
 * something is written to the history, with what it was and what it became.
 */
(function () {
  "use strict";
  var D = JSON.parse(document.getElementById("settings-defaults").textContent);
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  var TIER_NAMES = { 1: "Its own email", 2: "The daily digest", 3: "Recorded only" };

  function alerts() {
    var saved = Demo.load("alerts", {});
    var out = JSON.parse(JSON.stringify(D.alerts));
    Object.keys(saved).forEach(function (k) { out[k] = saved[k]; });
    return out;
  }

  function lines(text) {
    return text.split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean);
  }

  // --- the notice above every section ------------------------------------------
  function say(saved, changes, problems) {
    var ok = document.getElementById("saved");
    var bad = document.getElementById("refused");
    // Hidden first, so a second save in a row replays the notice's entrance.
    ok.hidden = true;
    bad.hidden = true;
    void ok.offsetWidth;
    ok.hidden = !saved;
    bad.hidden = !problems;
    if (problems) {
      bad.querySelector("ul").replaceChildren.apply(bad.querySelector("ul"), problems.map(item));
      bad.scrollIntoView({ block: "nearest" });
      return;
    }
    ok.querySelector("strong").textContent = changes.length ? "Saved" : "Nothing had changed";
    ok.querySelector("ul").replaceChildren.apply(ok.querySelector("ul"),
      changes.length ? changes.map(item) : [item("So nothing was saved.")]);
    ok.scrollIntoView({ block: "nearest" });
  }

  function item(text) {
    var li = document.createElement("li");
    li.textContent = text;
    return li;
  }

  function on(id, handler) {
    var form = document.getElementById(id);
    if (form) { form.addEventListener("submit", function (event) { event.preventDefault(); handler(form); }); }
    return form;
  }

  // --- Alerts: send times and who receives everything ---------------------------
  var delivery = on("delivery", function () {
    var now = alerts();
    var want = {
      urgent_from: document.getElementById("urgent_from").value,
      urgent_to: document.getElementById("urgent_to").value,
      digest_at: document.getElementById("digest_at").value,
      digest_grace_hours: document.getElementById("digest_grace_hours").value.trim(),
      recipients: lines(document.getElementById("recipients").value)
    };
    var problems = [];
    [["urgent_from", "Urgent from"], ["urgent_to", "Urgent until"], ["digest_at", "Digest at"]].forEach(function (f) {
      if (!TIME.test(want[f[0]])) { problems.push(f[1] + " must be a time as HH:MM, got " + (want[f[0]] || "nothing")); }
    });
    var grace = Number(want.digest_grace_hours);
    if (want.digest_grace_hours === "" || !Number.isInteger(grace) || grace < 0 || grace > 24) {
      problems.push("Grace must be a whole number of hours between 0 and 24, got " + (want.digest_grace_hours || "nothing"));
    }
    want.recipients.forEach(function (a) { if (!EMAIL.test(a)) { problems.push("Not an email address: " + a); } });
    if (problems.length) { say(false, [], problems); return; }
    want.digest_grace_hours = grace;
    var changes = [];
    [["urgent_from", "Urgent from"], ["urgent_to", "Urgent until"], ["digest_at", "Digest at"], ["digest_grace_hours", "Grace, hours"]].forEach(function (f) {
      if (String(now[f[0]]) !== String(want[f[0]])) {
        changes.push(f[1] + ": " + now[f[0]] + " → " + want[f[0]]);
        Demo.record("Send times", changes[changes.length - 1]);
      }
    });
    var added = want.recipients.filter(function (a) { return now.recipients.indexOf(a) < 0; });
    var removed = now.recipients.filter(function (a) { return want.recipients.indexOf(a) < 0; });
    if (added.length || removed.length) {
      var parts = [];
      if (added.length) { parts.push("added " + added.join(", ")); }
      if (removed.length) { parts.push("removed " + removed.join(", ")); }
      changes.push("Every alert: " + parts.join("; "));
      Demo.record("Who is emailed", changes[changes.length - 1]);
    }
    if (changes.length) { saveAlerts(want); }
    say(true, changes);
    drawAlerts();
  });

  function saveAlerts(patch) {
    var saved = Demo.load("alerts", {});
    Object.keys(patch).forEach(function (k) { saved[k] = patch[k]; });
    Demo.save("alerts", saved);
  }

  function drawAlerts() {
    if (!delivery) { return; }
    var a = alerts();
    ["urgent_from", "urgent_to", "digest_at", "digest_grace_hours"].forEach(function (k) { document.getElementById(k).value = a[k]; });
    document.getElementById("recipients").value = a.recipients.join("\n");
    document.getElementById("recipient-count").textContent = a.recipients.length + " recipient" + (a.recipients.length === 1 ? "" : "s");

    var list = document.getElementById("category-alert-list");
    list.replaceChildren();
    var cats = Demo.load("categories", null) || D.categories;
    var followed = 0;
    cats.forEach(function (c) {
      var who = a.category_recipients[c.name] || [];
      followed += who.length ? 1 : 0;
      var row = document.createElement("details");
      row.className = "cat-row";
      row.innerHTML = '<summary><span class="cat-name"></span><span class="cat-count"></span></summary>' +
        '<div class="cat-body follow-body"><textarea rows="2" style="width:100%"></textarea></div>';
      row.querySelector(".cat-name").textContent = c.name;
      row.querySelector(".cat-count").textContent = who.length ? who.slice(0, 2).join(", ") + (who.length > 2 ? " and " + (who.length - 2) + " more" : "") : "Nobody";
      var box = row.querySelector("textarea");
      box.value = who.join("\n");
      box.dataset.category = c.name;
      box.setAttribute("aria-label", "Who follows " + c.name);
      list.appendChild(row);
    });
    document.getElementById("followed-count").textContent = followed + " of " + cats.length + " categories followed";

    var counts = { 1: 0, 2: 0, 3: 0 };
    document.querySelectorAll("#urgency select[data-key]").forEach(function (s) {
      s.value = String(a.tier_map[s.dataset.key]);
      counts[s.value] += 1;
    });
    document.getElementById("tier-count").textContent = Object.keys(a.tier_map).length + " mapped · " + counts[1] + " urgent, " + counts[2] + " digest, " + counts[3] + " recorded only";
  }

  on("category-alerts", function (form) {
    var now = alerts();
    var want = {};
    var problems = [];
    form.querySelectorAll("textarea[data-category]").forEach(function (box) {
      want[box.dataset.category] = lines(box.value);
      want[box.dataset.category].forEach(function (a) {
        if (!EMAIL.test(a)) { problems.push(box.dataset.category + ": not an email address: " + a); }
      });
    });
    if (problems.length) { say(false, [], problems); return; }
    var changes = [];
    Object.keys(want).forEach(function (name) {
      var was = now.category_recipients[name] || [];
      var added = want[name].filter(function (a) { return was.indexOf(a) < 0; });
      var removed = was.filter(function (a) { return want[name].indexOf(a) < 0; });
      if (added.length || removed.length) {
        var parts = [];
        if (added.length) { parts.push("added " + added.join(", ")); }
        if (removed.length) { parts.push("removed " + removed.join(", ")); }
        changes.push(name + ": " + parts.join("; "));
        Demo.record("Who is emailed", changes[changes.length - 1]);
      }
    });
    if (changes.length) { saveAlerts({ category_recipients: want }); }
    say(true, changes);
    drawAlerts();
  });

  on("urgency", function (form) {
    var now = alerts();
    var map = JSON.parse(JSON.stringify(now.tier_map));
    var changes = [];
    form.querySelectorAll("select[data-key]").forEach(function (s) {
      var tier = Number(s.value);
      if ([1, 2, 3].indexOf(tier) < 0) { return; }
      if (map[s.dataset.key] !== tier) {
        changes.push(s.dataset.label + ": " + TIER_NAMES[map[s.dataset.key]] + " → " + TIER_NAMES[tier]);
        Demo.record("Urgency", changes[changes.length - 1]);
        map[s.dataset.key] = tier;
      }
    });
    if (changes.length) { saveAlerts({ tier_map: map }); }
    say(true, changes);
    drawAlerts();
  });

  // --- Worth a look: generic settings, checked and saved, never applied -----------
  function worthValues() {
    var saved = Demo.load("worth", {});
    var out = {};
    var all = [];
    D.worth.forEach(function (row) { all.push(row); if (row.switch) { all.push(row.switch); } });
    all.forEach(function (s) { out[s.name] = Object.prototype.hasOwnProperty.call(saved, s.name) ? saved[s.name] : s.value; });
    return out;
  }

  function show(value) { return typeof value === "boolean" ? (value ? "on" : "off") : String(value); }

  var worth = on("worth", function (form) {
    var now = worthValues();
    var want = {};
    var problems = [];
    form.querySelectorAll("[data-setting]").forEach(function (input) {
      var name = input.dataset.setting;
      if (input.type === "checkbox") { want[name] = input.checked; return; }
      var raw = input.value.trim();
      var n = Number(raw);
      var low = Number(input.dataset.low), high = Number(input.dataset.high);
      if (raw === "" || !isFinite(n)) { problems.push(name + " must be a number"); return; }
      if (input.dataset.kind === "whole" && !Number.isInteger(n)) { problems.push(name + " must be a whole number"); return; }
      if (n < low || n > high) { problems.push(name + " must be between " + low + " and " + high + ", got " + raw); return; }
      want[name] = n;
    });
    if (problems.length) { say(false, [], problems); return; }
    var changes = [];
    Object.keys(want).forEach(function (name) {
      if (want[name] !== now[name]) {
        changes.push(name + ": " + show(now[name]) + " → " + show(want[name]));
        Demo.record("Worth a look", changes[changes.length - 1]);
      }
    });
    if (changes.length) { Demo.save("worth", want); }
    say(true, changes);
    drawWorth();
  });

  function drawWorth() {
    if (!worth) { return; }
    var values = worthValues();
    worth.querySelectorAll("[data-setting]").forEach(function (input) {
      var v = values[input.dataset.setting];
      if (input.type === "checkbox") { input.checked = v; } else { input.value = v; }
    });
  }

  // --- Priority words: who they would lift, saved but not applied -----------------
  var live = document.getElementById("live-bills");
  live = live ? JSON.parse(live.textContent) : [];

  function matching(phrase) {
    return live.filter(function (b) { return Demo.matches(phrase, b.title); });
  }

  function cleanPhrase(typed) {
    var phrase = typed.trim().replace(/\s+/g, " ").toLowerCase();
    if (phrase.length < 2) { return { problem: "A priority word needs at least 2 letters, or it would match almost every bill." }; }
    if (phrase.length > 60) { return { problem: "A priority word can be at most 60 characters." }; }
    return { phrase: phrase };
  }

  function preview(typed) {
    var box = document.getElementById("prio-preview");
    box.hidden = false;
    box.replaceChildren();
    var cleaned = cleanPhrase(typed);
    if (cleaned.problem) {
      var p = document.createElement("p");
      p.className = "prio-problem";
      p.textContent = cleaned.problem;
      box.appendChild(p);
      return;
    }
    var found = matching(cleaned.phrase);
    var head = document.createElement("p");
    head.innerHTML = "<b></b>";
    head.firstChild.textContent = "“" + cleaned.phrase + "” matches " + found.length + " bill" + (found.length === 1 ? "" : "s") + " before Parliament" + (found.length ? ":" : ".");
    box.appendChild(head);
    if (found.length) {
      var ul = document.createElement("ul");
      ul.className = "prio-bills";
      found.forEach(function (b) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = "bills/" + b.id + ".html";
        a.textContent = b.title;
        li.appendChild(a);
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    if (found.length > D.priority.places) {
      var warn = document.createElement("p");
      warn.className = "prio-warn";
      warn.textContent = "More than " + D.priority.places + " match. Only the " + D.priority.places + " the other settings rank highest are lifted.";
      box.appendChild(warn);
    }
    var add = document.createElement("form");
    add.className = "prio-add";
    add.noValidate = true;
    add.innerHTML =
      '<div class="prio-field"><label for="prio-boost">Boost <span class="prio-opt">' + D.priority.boost_low + " to " + D.priority.boost_high + '</span></label>' +
      '<input type="number" id="prio-boost" step="1"></div>' +
      '<div class="prio-field"><label for="prio-until">Until <span class="prio-opt">optional</span></label>' +
      '<input type="date" id="prio-until" min="2026-10-01"></div><button type="submit"></button>';
    add.querySelector("#prio-boost").value = D.priority.boost_default;
    add.querySelector("button").textContent = "Add “" + cleaned.phrase + "”";
    add.addEventListener("submit", function (event) {
      event.preventDefault();
      var raw = add.querySelector("#prio-boost").value.trim();
      var boost = Number(raw);
      if (raw === "" || !Number.isInteger(boost) || boost < D.priority.boost_low || boost > D.priority.boost_high) {
        say(false, [], ["Boost must be a whole number between " + D.priority.boost_low + " and " + D.priority.boost_high + ", got " + (raw || "nothing")]);
        return;
      }
      var words = Demo.load("priority", []).filter(function (w) { return w.phrase !== cleaned.phrase; });
      var held = Demo.load("priority", []).some(function (w) { return w.phrase === cleaned.phrase; });
      words.push({ phrase: cleaned.phrase, boost: boost, ends_on: add.querySelector("#prio-until").value || null, added_by: "User A" });
      Demo.save("priority", words);
      var said = (held ? "Priority word changed: " : "Priority word added: ") + "“" + cleaned.phrase + "”, boost " + boost;
      Demo.record("Worth a look", said);
      say(true, [said]);
      box.hidden = true;
      drawWords();
    });
    box.appendChild(add);
  }

  function drawWords() {
    var table = document.getElementById("prio-table");
    if (!table) { return; }
    var words = Demo.load("priority", []);
    var body = table.querySelector("tbody");
    body.replaceChildren();
    words.forEach(function (w) {
      var tr = document.createElement("tr");
      var n = matching(w.phrase).length;
      tr.innerHTML = '<td data-label="Word"><b></b></td><td data-label="Boost"></td><td data-label="Until"></td>' +
        '<td data-label="Matching now"><a href="#priority"></a></td><td data-label="Added by"></td>' +
        '<td class="actions"><button type="button" class="secondary">Remove</button></td>';
      var cells = tr.querySelectorAll("td");
      cells[0].firstChild.textContent = w.phrase;
      cells[1].textContent = w.boost;
      cells[2].textContent = w.ends_on || "No end date";
      cells[3].firstChild.textContent = n + " bill" + (n === 1 ? "" : "s");
      cells[3].firstChild.addEventListener("click", function () { document.getElementById("prio-try").value = w.phrase; preview(w.phrase); });
      cells[4].textContent = w.added_by;
      cells[5].querySelector("button").addEventListener("click", function () {
        Demo.save("priority", Demo.load("priority", []).filter(function (x) { return x.phrase !== w.phrase; }));
        var said = "Priority word removed: “" + w.phrase + "”";
        Demo.record("Worth a look", said);
        say(true, [said]);
        drawWords();
      });
      body.appendChild(tr);
    });
    table.hidden = !words.length;
    document.getElementById("prio-none").hidden = words.length > 0;
  }

  on("prio-try-form", function () { preview(document.getElementById("prio-try").value); });

  // --- Categories: names and keywords, which redraw every bill's chips -------------
  function categories() { return Demo.load("categories", null) || JSON.parse(JSON.stringify(D.categories)); }

  function checkCategory(name, keywords, others) {
    var problems = [];
    if (!name) { problems.push("A category needs a name"); }
    if (name.length > 60) { problems.push("A category name can be at most 60 characters"); }
    if (others.some(function (c) { return c.name.toLowerCase() === name.toLowerCase(); })) { problems.push("There is already a category called " + name); }
    keywords.forEach(function (k) {
      if (k.length < 2) { problems.push("A keyword needs at least 2 letters: " + k); }
      if (k.length > 60) { problems.push("A keyword can be at most 60 characters: " + k); }
    });
    return problems;
  }

  function keywordsOf(text) {
    var seen = [];
    lines(text).forEach(function (k) { k = k.replace(/\s+/g, " ").toLowerCase(); if (seen.indexOf(k) < 0) { seen.push(k); } });
    return seen.sort();
  }

  function drawCategoryList() {
    var list = document.getElementById("category-list");
    if (!list) { return; }
    var all = categories();
    document.getElementById("category-count").textContent = all.length + " categories · shown on the dashboard and in alert emails; who follows each is set in Alerts";
    list.replaceChildren();
    all.forEach(function (c, index) {
      var row = document.createElement("details");
      row.className = "cat-row";
      row.innerHTML = '<summary><span class="cat-name"></span><span class="cat-count"></span></summary>' +
        '<div class="cat-body"><form novalidate>' +
        '<div class="field"><label>Name</label><input type="text" maxlength="60"></div>' +
        '<div class="field"><label>Keywords, one per line</label><textarea rows="5"></textarea></div>' +
        '<button type="submit">Save changes</button></form>' +
        '<button type="button" class="secondary danger-quiet">Delete</button></div>';
      row.querySelector(".cat-name").textContent = c.name;
      row.querySelector(".cat-count").textContent = c.keywords.length + " keyword" + (c.keywords.length === 1 ? "" : "s");
      var nameBox = row.querySelector("input");
      var wordBox = row.querySelector("textarea");
      nameBox.value = c.name;
      wordBox.value = c.keywords.join("\n");
      nameBox.setAttribute("aria-label", "Name of " + c.name);
      wordBox.setAttribute("aria-label", "Keywords for " + c.name);
      row.querySelector("form").addEventListener("submit", function (event) {
        event.preventDefault();
        var name = nameBox.value.trim().replace(/\s+/g, " ");
        var words = keywordsOf(wordBox.value);
        var problems = checkCategory(name, words, all.filter(function (_, i) { return i !== index; }));
        if (problems.length) { say(false, [], problems); return; }
        var changes = [];
        if (name !== c.name) { changes.push("Renamed " + c.name + " → " + name); }
        if (words.join(", ") !== c.keywords.slice().sort().join(", ")) {
          changes.push("Keywords of " + name + ": " + (c.keywords.join(", ") || "none") + " → " + (words.join(", ") || "none"));
        }
        changes.forEach(function (line) { Demo.record("Categories", line); });
        if (changes.length) {
          all[index] = { name: name, keywords: words };
          Demo.save("categories", all);
        }
        say(true, changes);
        drawCategoryList();
      });
      row.querySelector(".danger-quiet").addEventListener("click", function () {
        if (!window.confirm("Delete " + c.name + "? Its keywords go with it.")) { return; }
        Demo.save("categories", all.filter(function (_, i) { return i !== index; }));
        Demo.record("Categories", "Deleted " + c.name + " (" + (c.keywords.join(", ") || "no keywords") + ")");
        say(true, ["Deleted " + c.name]);
        drawCategoryList();
      });
      list.appendChild(row);
    });
  }

  on("category-add", function (form) {
    var all = categories();
    var name = document.getElementById("cat-new-name").value.trim().replace(/\s+/g, " ");
    var words = keywordsOf(document.getElementById("cat-new-words").value);
    var problems = checkCategory(name, words, all);
    if (problems.length) { say(false, [], problems); return; }
    all.push({ name: name, keywords: words });
    Demo.save("categories", all);
    var said = "Added " + name + " (" + (words.join(", ") || "no keywords") + ")";
    Demo.record("Categories", said);
    say(true, [said]);
    form.reset();
    drawCategoryList();
  });

  // --- History: the seeded changes, then this visitor's, newest first ---------------
  function drawHistory() {
    var body = document.getElementById("history-rows");
    if (!body) { return; }
    var rows = D.history.concat(Demo.load("history", [])).reverse();
    body.replaceChildren();
    rows.forEach(function (ch) {
      var tr = document.createElement("tr");
      tr.innerHTML = '<td class="tight" data-label="When"></td><td class="tight" data-label="Who"></td>' +
        '<td class="tight" data-label="Area"></td><td data-label="What"></td>';
      var cells = tr.querySelectorAll("td");
      cells[0].textContent = ch.when;
      cells[1].textContent = ch.who;
      cells[2].textContent = ch.area;
      cells[3].textContent = ch.what;
      body.appendChild(tr);
    });
  }

  drawAlerts();
  drawWorth();
  drawWords();
  drawCategoryList();
  drawHistory();
})();
