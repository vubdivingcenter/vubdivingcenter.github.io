(function () {
  "use strict";

  var metaEl = document.getElementById("print-meta");
  var summaryEl = document.getElementById("print-summary");
  var warningEl = document.getElementById("print-warning");
  var planEl = document.getElementById("print-plan");
  var reservesEl = document.getElementById("print-reserves");
  var printButton = document.getElementById("print-button");
  var backButton = document.getElementById("back-button");

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function base64ToUtf8(value) {
    var binary = atob(value);
    if (typeof TextDecoder !== "undefined") {
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder("utf-8").decode(bytes);
    }
    return decodeURIComponent(escape(binary));
  }

  function readPayload() {
    var params = new URLSearchParams(window.location.search);
    var encoded = params.get("data");
    if (encoded) {
      try {
        return JSON.parse(base64ToUtf8(encoded));
      } catch (error) {
        /* val terug op opslag */
      }
    }
    try {
      var sessionRaw = window.sessionStorage.getItem("vdcLessonPrintData");
      if (sessionRaw) return JSON.parse(sessionRaw);
    } catch (error) { /* opslag kan geblokkeerd zijn */ }
    try {
      var localRaw = window.localStorage.getItem("vdcLessonPrintData");
      if (localRaw) return JSON.parse(localRaw);
    } catch (error) { /* opslag kan geblokkeerd zijn */ }
    return null;
  }

  function formatCreatedAt(value) {
    if (!value) return "";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "";
    try {
      return date.toLocaleString("nl-BE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (error) {
      return date.toISOString();
    }
  }

  function renderMeta(payload) {
    var session = payload.session || {};
    var total = Number(session.totalMinutes || payload.totalMinutes || 0);
    var endTime = session.endTime || "21:00";
    var parts = [];

    if (session.levelLabel) parts.push("Niveau: " + session.levelLabel);
    if (session.candidates) parts.push(session.candidates + " kandidaten");
    if (session.topic) parts.push("Thema: " + session.topic);
    var createdAt = formatCreatedAt(payload.createdAt);
    if (createdAt) parts.push("Gemaakt op " + createdAt);

    if (metaEl) {
      metaEl.textContent = "Planning 20:00–" + endTime + " · " + total + " min" +
        (parts.length > 0 ? " · " + parts.join(" · ") : "");
    }
    if (summaryEl) {
      var planCount = Array.isArray(payload.plan) ? payload.plan.length : 0;
      var reserveCount = Array.isArray(payload.reserves) ? payload.reserves.length : 0;
      summaryEl.textContent = planCount + " oefeningen · " + total + " / 60 min · " +
        reserveCount + " reserve-oefening" + (reserveCount === 1 ? "" : "en");
    }

    if (warningEl && total !== 60) {
      warningEl.hidden = false;
      warningEl.textContent = total < 60
        ? "Let op: deze planning duurt " + total + " minuten en vult 20:00–21:00 niet volledig (" + (60 - total) + " min te kort)."
        : "Let op: deze planning duurt " + total + " minuten en loopt " + (total - 60) + " minuten na 21:00.";
    }
  }

  function renderMaterials(item) {
    var materials = Array.isArray(item.materials) ? item.materials : [];
    if (materials.length === 0) return "";
    var html = "<div class=\"print-item-material\"><strong>Materiaal</strong><ul>";
    for (var i = 0; i < materials.length; i++) {
      html += "<li>" + escapeHtml(materials[i]) + "</li>";
    }
    html += "</ul></div>";
    return html;
  }

  function renderSteps(item) {
    var steps = Array.isArray(item.steps) ? item.steps : [];
    if (steps.length === 0) return "";
    var html = "<ol class=\"print-item-steps\">";
    for (var i = 0; i < steps.length; i++) {
      html += "<li>" + escapeHtml(steps[i]) + "</li>";
    }
    html += "</ol>";
    return html;
  }

  function renderPlan(payload) {
    var rows = Array.isArray(payload.plan) ? payload.plan : [];
    if (rows.length === 0) {
      planEl.innerHTML = "<p class=\"empty\">Geen planning beschikbaar.</p>";
      return;
    }

    var html = "";
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var metaParts = [];
      if (row.durationMinutes) metaParts.push(row.durationMinutes + " min");
      if (row.section) metaParts.push(row.section);
      if (row.levels && row.levels !== "n.v.t.") metaParts.push(row.levels);
      if (row.repetitions) metaParts.push("Herhaling: " + row.repetitions);
      if (row.setupEffort) metaParts.push(row.setupEffort);

      html += "<section class=\"print-item\">" +
        "<div class=\"print-item-header\">" +
          "<h3 class=\"print-item-title\">" + escapeHtml((row.index || (i + 1)) + ". " + (row.name || "")) + "</h3>" +
          (row.timeLabel ? "<span class=\"print-item-time\">" + escapeHtml(row.timeLabel) + "</span>" : "") +
        "</div>" +
        (metaParts.length > 0 ? "<p class=\"print-item-meta\">" + escapeHtml(metaParts.join(" · ")) + "</p>" : "") +
        (row.description ? "<p class=\"print-item-description\">" + escapeHtml(row.description) + "</p>" : "") +
        renderMaterials(row) +
        renderSteps(row) +
        "</section>";
    }
    planEl.innerHTML = html;
  }

  function renderReserves(payload) {
    var rows = Array.isArray(payload.reserves) ? payload.reserves : [];
    if (rows.length === 0) {
      reservesEl.innerHTML = "<p class=\"empty\">Geen reserve-oefeningen.</p>";
      return;
    }

    var html = "";
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      html += "<article class=\"print-reserve\">" +
        "<h3>" + escapeHtml((i + 1) + ". " + (row.name || "")) + "</h3>" +
        "<p>" + escapeHtml((row.durationMinutes || 0) + " min" + (row.section ? " · " + row.section : "")) + "</p>" +
        (row.description ? "<p>" + escapeHtml(row.description) + "</p>" : "") +
        renderMaterials(row) +
        "</article>";
    }
    reservesEl.innerHTML = html;
  }

  document.title = "Lesplanning vrijdagtraining";

  if (printButton) {
    printButton.addEventListener("click", function () {
      window.print();
    });
  }
  if (backButton) {
    backButton.addEventListener("click", function () {
      if (window.history.length > 1) window.history.back();
      else window.location.href = "/les-samenstellen/";
    });
  }

  try {
    var payload = readPayload();
    if (!payload) {
      if (metaEl) metaEl.textContent = "Geen planningsdata gevonden. Open eerst de planner en kies Print / PDF.";
      if (summaryEl) summaryEl.textContent = "Geen planning beschikbaar.";
      planEl.innerHTML = "<p class=\"empty\">Geen planning beschikbaar.</p>";
      reservesEl.innerHTML = "<p class=\"empty\">Geen reserve-oefeningen.</p>";
      return;
    }
    renderMeta(payload);
    renderPlan(payload);
    renderReserves(payload);
  } catch (error) {
    if (metaEl) metaEl.textContent = "Fout bij laden van de printdata.";
    planEl.innerHTML = "<p class=\"empty\">Geen planning beschikbaar.</p>";
    reservesEl.innerHTML = "<p class=\"empty\">Geen reserve-oefeningen.</p>";
  }
})();
