---
layout: main
title: Les samenstellen
subtitle: Vrijdagtrainingen voor gevorderden
background: https://lh3.googleusercontent.com/WnOS8K4-loEnfWON7hw560NIZUkxurveC10MVXXHZjNygkSlqVLS1GbARwHsfSr0p8xGq7fXs47LKCwTMzU2TY3KM9w8Qj_6bo3sM9e5TrBAiMEWzjUPeV_gEZHzMq64MVlKMwKHrzw
eleventyNavigation:
    key: Les samenstellen
    parent: Leden
---

Met deze tool stel je een vrijdagtraining van **exact één uur (20:00–21:00)** samen op basis van de oefenfiches uit **vdc-oefeningen**, aangevuld met extra trainingsideeën. Je kan zelf oefeningen toevoegen, de volgorde en duur aanpassen, of een volledig voorstel laten genereren.

<p id="builder-material-summary" class="lesson-builder-hint">Beschikbaar materiaal wordt geladen uit de oefendata.</p>

<div class="lesson-builder" data-lesson-builder>
  <div class="lesson-builder-controls">
    <div class="lesson-builder-field">
      <label for="builder-level">Niveau</label>
      <select id="builder-level">
        <option value="all">Alle niveaus</option>
        <option value="initiate">Initiatie</option>
        <option value="graduate">Gevorderd</option>
        <option value="bachelor">Bachelor</option>
      </select>
    </div>
    <div class="lesson-builder-field">
      <label for="builder-candidates">Aantal kandidaten</label>
      <input id="builder-candidates" type="number" min="1" max="40" value="8">
    </div>
    <div class="lesson-builder-field">
      <label for="builder-search">Zoekterm</label>
      <input id="builder-search" type="search" placeholder="bv. apnea, bril, buddy">
    </div>
    <div class="lesson-builder-field">
      <label for="builder-topic">Thema / focus</label>
      <input id="builder-topic" type="text" placeholder="bv. redding, trim, apnea">
    </div>
    <div class="lesson-builder-field lesson-builder-field-wide">
      <span class="lesson-builder-label" id="builder-material-label">Gebruikt materiaal</span>
      <div class="lesson-builder-material-dropdown">
        <button id="builder-material-toggle" type="button" class="lesson-builder-material-toggle" aria-expanded="false" aria-controls="builder-materials">
          Alle materiaal geselecteerd
        </button>
        <div id="builder-materials" class="lesson-builder-materials" hidden>
          <div class="lesson-builder-material-actions">
            <button type="button" data-material-all>Alles</button>
            <button type="button" data-material-none>Geen</button>
          </div>
        </div>
      </div>
    </div>
    <div class="lesson-builder-field lesson-builder-field-check">
      <label for="builder-variations"><input id="builder-variations" type="checkbox"> Toon varianten</label>
    </div>
  </div>

  <div class="lesson-builder-actions">
    <button id="builder-generate" class="btn btn-secondary" type="button">
      <i class="fa-solid fa-wand-magic-sparkles"></i> Genereer voorstel
    </button>
    <button id="builder-print" class="btn btn-primary" type="button">
      <i class="fa-solid fa-print"></i> Print / PDF
    </button>
    <button id="builder-clear" class="btn btn-grey" type="button">
      <i class="fa-solid fa-trash"></i> Leeg planning
    </button>
  </div>

  <p id="builder-status" class="lesson-builder-status" role="status" aria-live="polite"></p>

  <details id="builder-ai" class="lesson-builder-ai">
    <summary><i class="fa-solid fa-robot" aria-hidden="true"></i> AI gebruiken voor een lesvoorstel</summary>
    <div class="lesson-builder-ai-body">
      <p>Laat ChatGPT, Claude of een andere AI een lesvoorstel maken op basis van jouw filters en thema. De korte AI-opdracht verwijst naar de <a href="/les-samenstellen/ai/lesplan-instructies.md">online instructies</a> en de oefeningen-URL's (het volledige oefeningenbestand en de leesbare lijst); de volledige catalogus wordt niet in de opdracht gekopieerd. Je krijgt een leesbaar voorstel terug dat je als inspiratie gebruikt of manueel in de planner overneemt.</p>
      <div class="lesson-builder-ai-actions">
        <button id="builder-ai-copy" class="btn btn-secondary" type="button">
          <i class="fa-solid fa-copy"></i> Kopieer AI-opdracht
        </button>
        <a class="btn btn-primary" href="https://chatgpt.com/" target="_blank" rel="noopener">Open ChatGPT</a>
        <a class="btn btn-grey" href="https://claude.ai/new" target="_blank" rel="noopener">Open Claude</a>
        <a class="btn btn-grey" href="/les-samenstellen/ai/">Uitleg en voorbeeld</a>
      </div>
      <p id="builder-ai-status" class="lesson-builder-status" role="status" aria-live="polite"></p>

      <details class="lesson-builder-ai-prompt-wrap">
        <summary>Bekijk de AI-opdracht</summary>
        <pre id="builder-ai-prompt" class="lesson-builder-ai-prompt"></pre>
      </details>
      <p class="lesson-builder-hint">De AI geeft een gewoon leesbaar lesvoorstel. Gebruik de planner om de gekozen oefeningen zelf samen te stellen en de 20:00–21:00-bewaking te behouden.</p>
    </div>
  </details>

  <div class="lesson-builder-grid">
    <section class="lesson-builder-panel lesson-builder-panel-exercises">
      <div class="lesson-builder-panel-head">
        <h3>Beschikbare oefeningen</h3>
        <span id="builder-exercise-count" class="lesson-builder-count"></span>
      </div>
      <div id="builder-exercises" class="lesson-builder-list"></div>
    </section>
    <section class="lesson-builder-panel lesson-builder-panel-plan">
      <div class="lesson-builder-print-header">
        <img src="/images/logo.svg" alt="VDC logo">
        <div>
          <h3>VUB Diving Center - Planning vrijdagtraining</h3>
          <p id="builder-print-meta"></p>
        </div>
      </div>
      <div class="lesson-builder-panel-head">
        <h3>Geselecteerde training</h3>
        <span id="builder-plan-count" class="lesson-builder-count"></span>
      </div>
      <div id="builder-summary" class="lesson-builder-summary" aria-live="polite">
        <div class="lesson-builder-summary-top">
          <strong><span id="builder-total-minutes">0</span> / 60 min</strong>
          <span class="lesson-builder-summary-end">20:00–<span id="builder-end-time">21:00</span></span>
        </div>
        <div id="builder-progress" class="lesson-builder-progress" role="progressbar" aria-label="Gevulde trainingstijd" aria-valuemin="0" aria-valuemax="60" aria-valuenow="0">
          <span id="builder-progress-bar"></span>
        </div>
        <p id="builder-gap" class="lesson-builder-gap"></p>
        <p id="builder-warnings" class="lesson-builder-warning" role="status" aria-live="polite" hidden></p>
      </div>
      <div id="builder-plan" class="lesson-builder-list lesson-builder-plan"></div>
      <div class="lesson-builder-reserve-head">
        <h4>Reserve-oefeningen</h4>
        <p>Extra oefeningen die je kan inzetten als er tijd over is of als een oefening wegvalt.</p>
      </div>
      <div id="builder-reserves" class="lesson-builder-list lesson-builder-plan"></div>
    </section>
  </div>
</div>

<script src="/scripts/les-samenstellen.js?version={{ assetVersion }}"></script>
