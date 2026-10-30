/* Search, filter and sort for a list already on the page (Votes, Members).
 *
 * Rows carry data-* fields; each form control's name is the field it filters,
 * and "q" searches data-text. A group (a sitting day, a House) hides when none
 * of its rows are left. The address keeps the choices, so a list can be shared.
 */
(function () {
  "use strict";
  var form = document.querySelector("form[data-list-form]");
  if (!form) { return; }
  var rows = Array.prototype.slice.call(document.querySelectorAll("[data-row]"));
  var groups = Array.prototype.slice.call(document.querySelectorAll("[data-group]"));
  var flat = document.querySelector("[data-flat]");
  var params = new URLSearchParams(window.location.search);
  var fields = Array.prototype.slice.call(form.elements).filter(function (e) { return e.name && e.name !== "sort"; });
  var sorter = document.getElementById("sort");
  var dirButton = document.getElementById("sort-dir");
  var DIRS = JSON.parse((dirButton && dirButton.dataset.dirs) || "{}");
  var dir = "desc";

  fields.forEach(function (e) { if (params.get(e.name)) { e.value = params.get(e.name); } });
  if (sorter && params.get("sort")) { sorter.value = params.get("sort"); }
  if (params.get("dir")) { dir = params.get("dir"); }

  function keep(row) {
    return fields.every(function (e) {
      var want = e.value.trim().toLowerCase();
      if (!want) { return true; }
      if (e.name === "q") { return row.dataset.text.indexOf(want) >= 0; }
      return (row.dataset[e.name] || "").toLowerCase() === want;
    });
  }

  function draw() {
    var shown = 0;
    rows.forEach(function (row) { row.hidden = !keep(row); shown += row.hidden ? 0 : 1; });
    var byDate = !sorter || sorter.value === "date";
    if (flat) {
      // Ordered by anything but date, the day headings would repeat: show one flat list.
      var key = sorter.value;
      var sorted = rows.slice().sort(function (a, b) {
        var x = key === "margin" ? Number(a.dataset.margin) : a.dataset[key];
        var y = key === "margin" ? Number(b.dataset.margin) : b.dataset[key];
        var order = x < y ? -1 : x > y ? 1 : 0;
        return dir === "asc" ? order : -order;
      });
      flat.hidden = byDate;
      if (!byDate) { sorted.forEach(function (row) { flat.appendChild(row); }); }
      else { rows.forEach(function (row) { document.querySelector('[data-day-box="' + row.dataset.day + '"]').appendChild(row); }); }
      if (byDate && dir === "asc") { groups.slice().reverse().forEach(function (g) { g.parentNode.appendChild(g); }); }
      else if (byDate) { groups.forEach(function (g) { g.parentNode.appendChild(g); }); }
    }
    groups.forEach(function (g) {
      g.hidden = !byDate || !g.querySelector("[data-row]:not([hidden])");
    });
    var filtered = fields.some(function (e) { return e.value.trim(); });
    document.querySelectorAll("[data-count]").forEach(function (el) {
      el.textContent = shown + " shown" + (filtered ? " · filtered" : "");
    });
    var empty = document.querySelector("[data-empty]");
    if (empty) { empty.hidden = shown > 0; }
    var clear = document.getElementById("clear");
    if (clear) { clear.hidden = !filtered; }
    if (dirButton) { dirButton.querySelector("span").textContent = DIRS[(sorter ? sorter.value : "") + " " + dir] || ""; }
  }

  function go() {
    var next = new URLSearchParams();
    fields.forEach(function (e) { if (e.value.trim()) { next.set(e.name, e.value.trim()); } });
    if (sorter && sorter.value !== "date") { next.set("sort", sorter.value); }
    if (dir !== "desc") { next.set("dir", dir); }
    window.history.replaceState(null, "", window.location.pathname.split("/").pop() + (next.toString() ? "?" + next : ""));
    draw();
  }

  form.addEventListener("submit", function (event) { event.preventDefault(); go(); });
  fields.forEach(function (e) {
    e.addEventListener(e.tagName === "SELECT" ? "change" : "input", go);
  });
  if (sorter) {
    sorter.addEventListener("change", function () { dir = sorter.value === "name" ? "asc" : "desc"; go(); });
  }
  if (dirButton) {
    dirButton.addEventListener("click", function () { dir = dir === "asc" ? "desc" : "asc"; go(); });
  }
  draw();
})();
