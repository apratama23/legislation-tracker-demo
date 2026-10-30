/* The bills list: filter, sort and open the side panel, all from the address.
 *
 * The page holds every bill; this hides the ones a filter leaves out, so a
 * link such as bills.html?stalled=1 lands on the stalled bills, and the
 * heading says what the list is showing. On a screen wide enough, a click
 * opens the bill in the side panel instead of leaving the list.
 */
(function () {
  "use strict";
  var list = document.getElementById("bill-rows");
  var rows = Array.prototype.slice.call(list.querySelectorAll("a.bill-row"));
  var form = document.getElementById("bill-search");
  var wrap = document.querySelector(".idx-wrap");
  var wide = window.matchMedia("(min-width: 981px)");
  var params = new URLSearchParams(window.location.search);
  var CHAMBERS = { LA: "Legislative Assembly", LC: "Legislative Council" };
  var DIRECTIONS = {
    "moved desc": "Newest first", "moved asc": "Oldest first",
    "progress desc": "Furthest first", "progress asc": "Least first",
    "introduced desc": "Newest first", "introduced asc": "Oldest first",
    "title asc": "A to Z", "title desc": "Z to A"
  };
  var DEFAULT_DIR = { moved: "desc", progress: "desc", introduced: "desc", title: "asc" };
  var FIELDS = ["q", "house", "stage", "bill_type", "category", "year"];

  FIELDS.forEach(function (name) {
    if (params.get(name)) { form.elements[name].value = params.get(name); }
  });
  var sort = DEFAULT_DIR[params.get("sort")] ? params.get("sort") : "moved";
  var dir = params.get("dir") === "asc" || params.get("dir") === "desc" ? params.get("dir") : DEFAULT_DIR[sort];
  form.elements.sort.value = sort;

  function heading() {
    // What the list is showing, in words, so a filtered list never reads as everything.
    var parts = [];
    if (params.get("label")) { return params.get("label"); }
    if (params.get("stalled")) { parts.push("Bills that have stopped moving"); }
    if (params.get("category")) { parts.push(params.get("category")); }
    if (params.get("status") && !params.get("stalled")) { parts.push(params.get("status")); }
    if (params.get("house")) { parts.push(CHAMBERS[params.get("house")] || params.get("house")); }
    if (params.get("started")) { parts.push("began in the " + (CHAMBERS[params.get("started")] || "")); }
    if (params.get("bill_type") === "private_member") { parts.push("private members' bills"); }
    if (params.get("stage")) { parts.push("at " + params.get("stage")); }
    if (params.get("year")) { parts.push(params.get("year")); }
    if (params.get("q")) { parts.push("matching “" + params.get("q") + "”"); }
    return parts.join(" · ") || "Bills";
  }

  function keep(row) {
    var d = row.dataset;
    var ids = params.get("ids");
    if (ids && ids.split(",").indexOf(d.id) < 0) { return false; }
    if (params.get("q") && d.title.indexOf(params.get("q").toLowerCase()) < 0) { return false; }
    if (params.get("house") && d.house !== params.get("house")) { return false; }
    if (params.get("stage") && d.stage !== params.get("stage")) { return false; }
    if (params.get("bill_type") && d.type !== params.get("bill_type")) { return false; }
    if (params.get("category") && d.cats.indexOf("|" + params.get("category") + "|") < 0) { return false; }
    if (params.get("year") && d.year !== params.get("year")) { return false; }
    if (params.get("status") && d.status !== params.get("status")) { return false; }
    if (params.get("stalled") && !d.stalled) { return false; }
    if (params.get("started") && d.started !== params.get("started")) { return false; }
    return true;
  }

  function key(row) {
    var d = row.dataset;
    if (sort === "progress") { return Number(d.progress); }
    if (sort === "title") { return d.title; }
    return sort === "introduced" ? d.introduced : d.moved;
  }

  function draw() {
    var shown = rows.filter(keep);
    shown.sort(function (a, b) {
      var x = key(a), y = key(b);
      var order = x < y ? -1 : x > y ? 1 : 0;
      return dir === "asc" ? order : -order;
    });
    rows.forEach(function (row) { row.hidden = true; });
    shown.forEach(function (row) { row.hidden = false; list.appendChild(row); });
    var filtered = FIELDS.concat(["status", "stalled", "started", "ids"]).some(function (n) { return params.get(n); });
    document.getElementById("bills-count").textContent = shown.length + " shown" + (filtered ? " · filtered" : "");
    document.getElementById("bills-heading").textContent = heading();
    document.getElementById("bills-empty").hidden = shown.length > 0;
    document.getElementById("clear").hidden = !filtered;
    document.querySelector("#sort-dir span").textContent = DIRECTIONS[sort + " " + dir];
  }

  function go() {
    // Rewrite the address, so the list can be shared or reloaded as it is.
    var next = new URLSearchParams();
    FIELDS.forEach(function (name) { if (form.elements[name].value) { next.set(name, form.elements[name].value); } });
    ["status", "stalled", "started", "ids", "label"].forEach(function (name) { if (params.get(name)) { next.set(name, params.get(name)); } });
    if (sort !== "moved") { next.set("sort", sort); }
    if (dir !== DEFAULT_DIR[sort]) { next.set("dir", dir); }
    params = next;
    window.history.replaceState(null, "", "bills.html" + (next.toString() ? "?" + next : ""));
    draw();
  }

  form.addEventListener("submit", function (event) { event.preventDefault(); go(); });
  form.elements.sort.addEventListener("change", function () { sort = form.elements.sort.value; dir = DEFAULT_DIR[sort]; go(); });
  document.getElementById("sort-dir").addEventListener("click", function () { dir = dir === "asc" ? "desc" : "asc"; go(); });
  ["house", "stage", "bill_type", "category"].forEach(function (name) {
    form.elements[name].addEventListener("change", go);
  });
  form.elements.q.addEventListener("input", function () {
    window.clearTimeout(form.typing);
    form.typing = window.setTimeout(go, 200);
  });

  // --- the side panel ---------------------------------------------------------
  function open(id) {
    var template = document.getElementById("panel-" + id);
    if (!template) { return; }
    var already = wrap.querySelector("aside.side");
    var side = already || wrap.appendChild(document.createElement("aside"));
    side.className = "side";
    side.setAttribute("tabindex", "-1");
    side.replaceChildren(template.content.cloneNode(true));
    // Arriving slides in from the side it lives on; switching bills only crossfades.
    side.firstElementChild.classList.add(already ? "side-swap" : "side-arrive");
    wrap.classList.add("with-panel");
    rows.forEach(function (row) { row.classList.toggle("active", row.dataset.id === id); });
    if (window.Demo) { Demo.drawAllFollows(side); Demo.drawCategories(side); }
    side.focus({ preventScroll: true });
  }

  function close() {
    var side = wrap.querySelector("aside.side");
    if (side) { side.remove(); }
    wrap.classList.remove("with-panel");
    rows.forEach(function (row) { row.classList.remove("active"); });
  }

  wrap.addEventListener("click", function (event) {
    if (!wide.matches || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) { return; }
    var row = event.target.closest("a.bill-row");
    if (row) { event.preventDefault(); open(row.dataset.id); return; }
    if (event.target.closest("aside.side a.close")) { event.preventDefault(); close(); }
  });

  draw();
  if (params.get("open") && wide.matches) { open(params.get("open")); }
})();
