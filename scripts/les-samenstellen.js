(function () {
  "use strict";

  var DATA_URL = "/scripts/data/vdc-oefeningen.jsonld";
  var SESSION_START = "20:00";
  var SESSION_MINUTES = 60;
  var STORAGE_KEY = "vdcLessonBuilder.v2";
  var PRINT_KEY = "vdcLessonPrintData";
  var MIN_ITEM_MINUTES = 1;
  var MAX_ITEM_MINUTES = 45;
  var STEP_MINUTES = 5;
  var MAX_CANDIDATES = 40;

  var root = document.querySelector("[data-lesson-builder]");
  if (!root) return;

  var state = {
    all: [],
    filtered: [],
    plan: [],
    reserves: [],
    dataLoaded: false,
    restored: false
  };

  var levelInput = document.getElementById("builder-level");
  var candidatesInput = document.getElementById("builder-candidates");
  var searchInput = document.getElementById("builder-search");
  var topicInput = document.getElementById("builder-topic");
  var variationsInput = document.getElementById("builder-variations");
  var materialToggleButton = document.getElementById("builder-material-toggle");
  var materialsPanel = document.getElementById("builder-materials");
  var materialCheckboxes = [];
  var materialAllButton = document.querySelector("[data-material-all]");
  var materialNoneButton = document.querySelector("[data-material-none]");
  var generateButton = document.getElementById("builder-generate");
  var printButton = document.getElementById("builder-print");
  var clearButton = document.getElementById("builder-clear");
  var statusEl = document.getElementById("builder-status");
  var exercisesEl = document.getElementById("builder-exercises");
  var exerciseCountEl = document.getElementById("builder-exercise-count");
  var planEl = document.getElementById("builder-plan");
  var planCountEl = document.getElementById("builder-plan-count");
  var reservesEl = document.getElementById("builder-reserves");
  var totalMinutesEl = document.getElementById("builder-total-minutes");
  var endTimeEl = document.getElementById("builder-end-time");
  var gapEl = document.getElementById("builder-gap");
  var warningsEl = document.getElementById("builder-warnings");
  var summaryEl = document.getElementById("builder-summary");
  var progressEl = document.getElementById("builder-progress");
  var progressBarEl = document.getElementById("builder-progress-bar");
  var printMetaEl = document.getElementById("builder-print-meta");
  var aiDetails = document.getElementById("builder-ai");
  var aiPromptEl = document.getElementById("builder-ai-prompt");
  var aiCopyButton = document.getElementById("builder-ai-copy");
  var aiStatusEl = document.getElementById("builder-ai-status");

  var MATERIAL_LABELS = {
    jacket: "Jacket",
    fles: "Fles",
    binnenontspanner: "Binnenontspanner",
    buitenontspanner: "Buitenontspanner",
    backpack: "Backpack",
    loodgordel: "Loodgordel",
    reddingsdummy: "Reddingsdummy",
    figuurkaarten: "Figuurkaarten",
    torpedo: "Mini-torpedo",
    frisbee: "Onderwaterfrisbee",
    hoepel: "Hoepel",
    buisjes_steentjes: "Buisjes met steentjes",
    knikkers: "Knikkers",
    dobbelstenen: "Dobbelstenen"
  };
  var LEVEL_LABELS = {
    initiate: "Initiatie",
    graduate: "Gevorderd",
    bachelor: "Bachelor"
  };
  var SECTION_LABELS = {
    warmup: "Opwarming",
    exercise: "Oefening",
    cooldown: "Afsluiter",
    buffer: "Buffer"
  };

  /* ---------------------------------------------------------------------------
   * Data helpers
   * ------------------------------------------------------------------------ */

  function getAdditionalProperty(item, name) {
    if (!item || !Array.isArray(item.additionalProperty)) return "";
    for (var i = 0; i < item.additionalProperty.length; i++) {
      var property = item.additionalProperty[i];
      if (property && property.name === name) return String(property.value || "");
    }
    return "";
  }

  function parseDurationMinutes(isoDuration) {
    if (!isoDuration) return 0;
    var match = String(isoDuration).match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
    if (!match) return 0;
    var hours = parseInt(match[1] || "0", 10);
    var minutes = parseInt(match[2] || "0", 10);
    return hours * 60 + minutes;
  }

  function parseCommaList(value) {
    if (!value) return [];
    return String(value).split(",").map(function (part) {
      return part.trim().toLowerCase();
    }).filter(Boolean);
  }

  function parseSteps(item) {
    if (Array.isArray(item.step) && item.step.length > 0) {
      return item.step.map(function (step, index) {
        if (typeof step === "string") return step;
        if (step && typeof step.text === "string") return step.text;
        if (step && typeof step.name === "string") return step.name;
        return "Stap " + (index + 1);
      }).filter(Boolean);
    }
    var fallback = getAdditionalProperty(item, "instructions");
    if (fallback) {
      return fallback.split("|").map(function (part) {
        return part.trim();
      }).filter(Boolean);
    }
    return [];
  }

  function parseTeaches(item) {
    var values = [];
    if (Array.isArray(item.teaches)) {
      for (var i = 0; i < item.teaches.length; i++) {
        var term = item.teaches[i];
        if (term && typeof term.name === "string") values.push(term.name);
        else if (typeof term === "string") values.push(term);
      }
    }
    return values;
  }

  function extractBom(item) {
    var bom = [];
    if (Array.isArray(item.supply) && item.supply.length > 0) {
      for (var i = 0; i < item.supply.length; i++) {
        var name = "";
        if (item.supply[i] && typeof item.supply[i].name === "string") {
          name = item.supply[i].name.trim();
        } else if (typeof item.supply[i] === "string") {
          name = item.supply[i].trim();
        }
        if (name && bom.indexOf(name) === -1) bom.push(name);
      }
    }
    if (bom.length === 0) {
      bom.push("Basismateriaal: masker, snorkel, vinnen");
    }
    return bom;
  }

  function materialKeysFromText(text) {
    var value = String(text || "").toLowerCase();
    var keys = [];
    if (value.indexOf("jacket") >= 0) keys.push("jacket");
    if (value.indexOf("fles") >= 0) keys.push("fles");
    if (value.indexOf("binnenontspanner") >= 0) keys.push("binnenontspanner");
    if (value.indexOf("buitenontspanner") >= 0 || value.indexOf("octopus") >= 0) keys.push("buitenontspanner");
    if (value.indexOf("backpack") >= 0) keys.push("backpack");
    if (value.indexOf("torpedo") >= 0) keys.push("torpedo");
    if (value.indexOf("frisbee") >= 0) keys.push("frisbee");
    if (value.indexOf("hoepel") >= 0) keys.push("hoepel");
    if (value.indexOf("buis") >= 0 && value.indexOf("steen") >= 0) keys.push("buisjes_steentjes");
    if (value.indexOf("knikker") >= 0) keys.push("knikkers");
    if (value.indexOf("dobbel") >= 0) keys.push("dobbelstenen");
    if (value.indexOf("loodgordel") >= 0 || value.indexOf("loodzak") >= 0) keys.push("loodgordel");
    if (value.indexOf("reddingsdummy") >= 0 || value.indexOf("dummy") >= 0) keys.push("reddingsdummy");
    if (value.indexOf("figuur") >= 0 || value.indexOf("geplastific") >= 0) keys.push("figuurkaarten");
    return keys;
  }

  function extractMaterials(item) {
    var keys = [];
    if (Array.isArray(item.supply)) {
      for (var i = 0; i < item.supply.length; i++) {
        var supplyName = "";
        if (item.supply[i] && typeof item.supply[i].name === "string") {
          supplyName = item.supply[i].name;
        } else if (typeof item.supply[i] === "string") {
          supplyName = item.supply[i];
        }
        var found = materialKeysFromText(supplyName);
        for (var j = 0; j < found.length; j++) {
          if (keys.indexOf(found[j]) === -1) keys.push(found[j]);
        }
      }
    }
    return keys;
  }

  function deriveSetupEffort(materials) {
    if (!Array.isArray(materials) || materials.length === 0) return "";
    if (materials.indexOf("figuurkaarten") >= 0 || materials.indexOf("buisjes_steentjes") >= 0 || materials.indexOf("hoepel") >= 0) {
      return "meer";
    }
    if (materials.indexOf("jacket") >= 0 || materials.indexOf("fles") >= 0 || materials.indexOf("backpack") >= 0) {
      return "gemiddeld";
    }
    return "laag";
  }

  function setupEffortLabel(value) {
    if (value === "meer") return "meer opbouwtijd";
    if (value === "gemiddeld") return "gemiddelde opbouwtijd";
    if (value === "laag") return "snelle opbouw";
    return "";
  }

  function normalizeExercise(item) {
    if (!item || item["@type"] !== "ExercisePlan") return null;
    var levels = parseCommaList(getAdditionalProperty(item, "difficulty"));
    if (levels.length === 0 && item.audience && item.audience.audienceType) {
      levels = parseCommaList(item.audience.audienceType);
    }
    var section = normalizeSection(getAdditionalProperty(item, "section") || "exercise");
    var minCandidates = parseInt(getAdditionalProperty(item, "minCandidates") || "1", 10);
    var maxCandidatesRaw = getAdditionalProperty(item, "maxCandidates");
    var maxCandidates = maxCandidatesRaw ? parseInt(maxCandidatesRaw, 10) : null;
    var materials = extractMaterials(item);
    var duration = parseDurationMinutes(item.activityDuration) || 10;

    return {
      id: item["@id"],
      baseId: item["@id"],
      name: item.name || "Naamloze oefening",
      description: item.description || "",
      durationMinutes: clamp(duration, MIN_ITEM_MINUTES, SESSION_MINUTES),
      section: section,
      repetitions: getAdditionalProperty(item, "repetitions"),
      startTime: getAdditionalProperty(item, "startTime"),
      levels: levels,
      minCandidates: isNaN(minCandidates) ? 1 : minCandidates,
      maxCandidates: isNaN(maxCandidates) ? null : maxCandidates,
      isVariation: false,
      isCustom: false,
      isBuffer: false,
      variationOf: "",
      instructionSteps: parseSteps(item),
      teaches: parseTeaches(item),
      materials: materials,
      bom: extractBom(item),
      setupEffort: getAdditionalProperty(item, "setupEffort") || deriveSetupEffort(materials)
    };
  }

  function cloneExercise(exercise) {
    return {
      id: exercise.id,
      baseId: exercise.baseId,
      name: exercise.name,
      description: exercise.description,
      durationMinutes: exercise.durationMinutes,
      section: exercise.section,
      repetitions: exercise.repetitions,
      startTime: exercise.startTime,
      levels: Array.isArray(exercise.levels) ? exercise.levels.slice() : [],
      minCandidates: exercise.minCandidates,
      maxCandidates: exercise.maxCandidates,
      isVariation: !!exercise.isVariation,
      isCustom: !!exercise.isCustom,
      isBuffer: !!exercise.isBuffer,
      variationOf: exercise.variationOf || "",
      instructionSteps: Array.isArray(exercise.instructionSteps) ? exercise.instructionSteps.slice() : [],
      teaches: Array.isArray(exercise.teaches) ? exercise.teaches.slice() : [],
      materials: Array.isArray(exercise.materials) ? exercise.materials.slice() : [],
      bom: Array.isArray(exercise.bom) ? exercise.bom.slice() : [],
      setupEffort: exercise.setupEffort || ""
    };
  }

  function createVariations(exercises) {
    var expanded = exercises.slice();
    for (var i = 0; i < exercises.length; i++) {
      var exercise = exercises[i];

      if (exercise.section === "exercise" && exercise.durationMinutes >= 10) {
        var compact = cloneExercise(exercise);
        compact.id = exercise.id + "#compact";
        compact.name = exercise.name + " (compact)";
        compact.description = exercise.description + " Compacte variant met kortere duur en minder herhalingen.";
        compact.durationMinutes = Math.max(5, exercise.durationMinutes - 5);
        compact.repetitions = "compact";
        compact.isVariation = true;
        compact.variationOf = exercise.baseId;
        compact.instructionSteps = buildGeneratedSteps(compact).concat([
          "Beperk de oefening tot een korter interval en evalueer direct na elke poging."
        ]);
        expanded.push(compact);
      }

      if (exercise.section === "exercise" && exercise.durationMinutes <= 20) {
        var intense = cloneExercise(exercise);
        intense.id = exercise.id + "#intense";
        intense.name = exercise.name + " (intensief)";
        intense.description = exercise.description + " Intensieve variant met extra ronde en focus op tempo.";
        intense.durationMinutes = Math.min(30, exercise.durationMinutes + 5);
        intense.repetitions = "intensief";
        intense.isVariation = true;
        intense.variationOf = exercise.baseId;
        intense.instructionSteps = buildGeneratedSteps(intense).concat([
          "Voeg 1 extra ronde toe met aandacht voor veilige oppervlaktecontrole."
        ]);
        expanded.push(intense);
      }

      if (exercise.section === "warmup") {
        var technique = cloneExercise(exercise);
        technique.id = exercise.id + "#technique";
        technique.name = exercise.name + " (techniekfocus)";
        technique.description = exercise.description + " Extra nadruk op techniek en gecontroleerde uitvoering.";
        technique.durationMinutes = Math.min(15, exercise.durationMinutes + 5);
        technique.repetitions = "techniek";
        technique.isVariation = true;
        technique.variationOf = exercise.baseId;
        technique.instructionSteps = buildGeneratedSteps(technique).concat([
          "Voorzie na elke lengte 20 seconden technische feedback."
        ]);
        expanded.push(technique);
      }
    }
    return expanded;
  }

  /* ---------------------------------------------------------------------------
   * Instruction helpers
   * ------------------------------------------------------------------------ */

  function buildGeneratedSteps(exercise) {
    if (exercise.instructionSteps && exercise.instructionSteps.length > 0) {
      return exercise.instructionSteps;
    }
    var description = String(exercise.description || "").trim();
    var descriptionParts = description
      .split(/[.;]/)
      .map(function (part) { return part.trim(); })
      .filter(function (part) { return part.length > 8; });

    var patternSteps = buildPatternSpecificSteps(exercise);
    if (patternSteps && patternSteps.length > 0) return patternSteps;

    var setupStep = "Voorzie basismateriaal (masker, snorkel, vinnen) en spreek stopteken + veiligheidsrollen af.";
    if (exercise.materials && exercise.materials.length > 0) {
      setupStep = "Leg vooraf materiaal klaar: " + materialLabels(exercise.materials.slice(0, 4)) + ". Verdeel rollen per buddy.";
    }

    var executionStep = "Voer de oefening uit per buddy en hou tempo en communicatie constant.";
    if (descriptionParts.length > 0) executionStep = "Voer uit: " + normalizeSentence(descriptionParts[0]);

    var coachingStep = "Herhaal 2 tot 3 rondes en geef na elke ronde 1 concreet verbeterpunt.";
    if (descriptionParts.length > 1) coachingStep = "Voeg daarna toe: " + normalizeSentence(descriptionParts[1]);

    var closingStep = "Evalueer kort: techniek, veiligheid en samenwerking.";
    if (exercise.section === "warmup") {
      closingStep = "Bouw tempo geleidelijk op en sluit de opwarming af met rustige ademhaling.";
    } else if (exercise.section === "cooldown") {
      closingStep = "Rond af met herstel, ademcontrole en rustige materiaalcheck.";
    } else if (exercise.section === "buffer") {
      closingStep = "Gebruik deze tijd voor nabespreking, feedback en het opruimen van materiaal.";
    }

    return [
      "Brief kort het doel van deze oefening en wie welke veiligheidsrol opneemt.",
      setupStep,
      executionStep,
      coachingStep,
      closingStep
    ];
  }

  function buildPatternSpecificSteps(exercise) {
    var text = (String(exercise.name || "") + " " + String(exercise.description || "")).toLowerCase();

    if ((text.indexOf("ster-schaar-steen-papier") >= 0) || (text.indexOf("ster") >= 0 && text.indexOf("fles") >= 0)) {
      return [
        "Zet 1 fles in het midden en 3 of 4 flessen errond op gelijke afstand, zodat je een ster met duidelijke armen krijgt.",
        "Verdeel de groep in kleine teams; elk team start aan een eigen buitenfles met een buddy op oppervlakteveiligheid.",
        "Na het startsignaal zwemt elke duiker in apnea naar de middenfles, neemt 1 à 2 ademhalingen en kiest dan een nieuwe arm van de ster.",
        "Bij kruising aan de middenfles wordt kort steen-schaar-papier gespeeld: winnaar mag eerst vertrekken, verliezer wacht 2 tellen.",
        "Wissel na elke volledige sterronde van rollen en hou 1 vrije veiligheidsfles tussen midden en ondiep."
      ];
    }

    if (text.indexOf("buddybreath") >= 0 || text.indexOf("buddybreathing") >= 0 || text.indexOf("om beurten ademen aan fles") >= 0) {
      return [
        "Plaats de fles op stabiele diepte en duid per buddypaar donor/ontvanger aan voor de eerste ronde.",
        "Duiker A ademt 2 rustige cycli, geeft vervolgens de automaat gecontroleerd door aan duiker B zonder trimverlies.",
        "Na 4 overdrachten sluit het buddypaar de fles, stijgt gecontroleerd op en evalueert communicatie + signaalgebruik.",
        "Start een tweede ronde met omgekeerde rollen en focus op trage, duidelijke handelingen.",
        "Begeleid vanaf de knik met permanente oppervlakteveiligheid en stop onmiddellijk bij onrust."
      ];
    }

    if (text.indexOf("apnea") >= 0 && text.indexOf("achtje") >= 0) {
      return [
        "Baken twee keerpunten af (ondiep en diep) zodat de duiker een duidelijke 8-vorm kan zwemmen.",
        "Duiker 1 zwemt in apnea naar het eerste keerpunt, maakt een ruime bocht en kruist in het midden van de 8.",
        "Buddy blijft op snorkel boven het kruispunt en volgt de duiker visueel tot aan het einde van de lus.",
        "Aan het eindpunt wordt gewisseld: nieuwe duiker vertrekt pas na duidelijk OK-teken van beide buddies.",
        "Herhaal in korte reeksen en verleng pas de lus wanneer tempo en veiligheid stabiel blijven."
      ];
    }

    if (text.indexOf("parcours") >= 0 && text.indexOf("fles") >= 0) {
      return [
        "Plaats flessen op vaste punten (ondiep, knik, diep) zodat het parcours in één richting doorzwommen wordt.",
        "Leg startvolgorde vast per buddypaar om filevorming aan flessen te vermijden.",
        "Per fles: openen, 1 à 2 gecontroleerde ademhalingen nemen, fles sluiten en onmiddellijk door naar het volgende punt.",
        "Buddy controleert telkens of de fles echt dicht staat vóór vertrek naar het volgende station.",
        "Na elke ronde korte debrief: tijdswinst zoeken zonder stappen of veiligheid over te slaan."
      ];
    }

    if (text.indexOf("zonder bril") >= 0 || text.indexOf("no-mask") >= 0 || text.indexOf("masker") >= 0) {
      return [
        "Start op stabiele diepte met buddy op armlengte en spreek een onmiddellijk stopsignaal af.",
        "Voer eerst een korte gewenning uit: masker af, 3 rustige ademcycli, masker terug op en klaren.",
        "Doe daarna het traject (halve of volledige lengte) met gecontroleerde vinbeweging en rustige uitademing.",
        "Na elk traject controleert de buddy ademritme, oogcontact en trim voordat de volgende poging start.",
        "Werk progressief: pas verlengen van traject als de vorige stap volledig rustig en correct verliep."
      ];
    }

    return null;
  }

  function normalizeSentence(text) {
    var value = String(text || "").trim();
    if (!value) return "";
    var withCapital = value.charAt(0).toUpperCase() + value.slice(1);
    return /[.!?]$/.test(withCapital) ? withCapital : withCapital + ".";
  }

  /* ---------------------------------------------------------------------------
   * Labels & formatting
   * ------------------------------------------------------------------------ */

  function materialLabels(keys) {
    if (!Array.isArray(keys) || keys.length === 0) return "Geen specifiek materiaal";
    return keys.map(function (key) {
      return MATERIAL_LABELS[key] || key;
    }).join(", ");
  }

  function levelLabels(levels) {
    if (!Array.isArray(levels) || levels.length === 0) return "n.v.t.";
    return levels.map(function (level) {
      return LEVEL_LABELS[level] || level;
    }).join(", ");
  }

  function sectionLabel(section) {
    return SECTION_LABELS[section] || SECTION_LABELS.exercise;
  }

  function levelFilterLabel() {
    if (!levelInput || levelInput.value === "all") return "Alle niveaus";
    return LEVEL_LABELS[levelInput.value] || levelInput.value;
  }

  function clamp(value, min, max) {
    var number = parseInt(value, 10);
    if (isNaN(number)) number = min;
    if (number < min) return min;
    if (number > max) return max;
    return number;
  }

  function readCandidates() {
    return clamp(candidatesInput.value || "1", 1, MAX_CANDIDATES);
  }

  function timeToMinutes(value) {
    var parts = String(value || SESSION_START).split(":");
    if (parts.length !== 2) return 20 * 60;
    var hours = parseInt(parts[0], 10);
    var minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return 20 * 60;
    return hours * 60 + minutes;
  }

  function minutesToTime(value) {
    var minutes = ((value % 1440) + 1440) % 1440;
    var hours = Math.floor(minutes / 60);
    var rest = minutes % 60;
    return (hours < 10 ? "0" : "") + hours + ":" + (rest < 10 ? "0" : "") + rest;
  }

  function normalizeSection(value) {
    var normalized = String(value || "").toLowerCase().trim();
    if (normalized === "warmup" || normalized === "opwarming" || normalized === "warming" || normalized === "intro") {
      return "warmup";
    }
    if (normalized === "cooldown" || normalized === "afsluiter" || normalized === "cooling" || normalized === "debrief") {
      return "cooldown";
    }
    if (normalized === "buffer" || normalized === "break" || normalized === "nabespreking") {
      return "buffer";
    }
    return "exercise";
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function slugify(value) {
    return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "oefening";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------------------------------------------------------------------------
   * Filtering
   * ------------------------------------------------------------------------ */

  function getSelectedMaterials() {
    var selected = new Set();
    for (var i = 0; i < materialCheckboxes.length; i++) {
      if (materialCheckboxes[i].checked) selected.add(materialCheckboxes[i].dataset.materialKey);
    }
    return selected;
  }

  function extractMaterialSet(graph) {
    if (!Array.isArray(graph)) return [];
    var termSet = null;
    for (var i = 0; i < graph.length; i++) {
      if (graph[i] && graph[i]["@type"] === "DefinedTermSet" && Array.isArray(graph[i].hasDefinedTerm)) {
        termSet = graph[i];
        break;
      }
    }
    if (!termSet) return [];

    var materials = [];
    for (var j = 0; j < termSet.hasDefinedTerm.length; j++) {
      var term = termSet.hasDefinedTerm[j];
      var key = term && (term.termCode || term.identifier || term.name);
      var label = term && (term.name || term.termCode);
      if (key && label) materials.push({ key: String(key), label: String(label) });
    }
    return materials;
  }

  function applyMaterialSet(materials) {
    var entries = Array.isArray(materials) && materials.length > 0
      ? materials
      : Object.keys(MATERIAL_LABELS).map(function (key) { return { key: key, label: MATERIAL_LABELS[key] }; });
    if (entries.length === 0 || !materialsPanel) return;

    MATERIAL_LABELS = {};
    for (var i = 0; i < entries.length; i++) MATERIAL_LABELS[entries[i].key] = entries[i].label;

    var actions = materialsPanel.querySelector(".lesson-builder-material-actions");
    materialsPanel.innerHTML = "";
    if (actions) materialsPanel.appendChild(actions);

    for (var j = 0; j < entries.length; j++) {
      var label = document.createElement("label");
      var input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.materialKey = entries[j].key;
      input.checked = true;
      label.appendChild(input);
      label.appendChild(document.createTextNode(" " + entries[j].label));
      materialsPanel.appendChild(label);
    }
    materialCheckboxes = Array.prototype.slice.call(
      materialsPanel.querySelectorAll("input[type='checkbox'][data-material-key]")
    );

    var summary = document.getElementById("builder-material-summary");
    if (summary) {
      summary.textContent = "Beschikbaar materiaal: " + entries.map(function (entry) {
        return entry.label;
      }).join(", ") + ".";
    }
  }

  function showsVariations() {
    return !!(variationsInput && variationsInput.checked);
  }

  function exerciseMatchesFilters(exercise) {
    if (exercise.isVariation && !showsVariations()) return false;

    var selectedLevel = levelInput ? levelInput.value : "all";
    var candidates = readCandidates();
    var search = normalizeText(searchInput ? searchInput.value : "");
    var selectedMaterials = getSelectedMaterials();

    if (selectedLevel !== "all" && exercise.levels.indexOf(selectedLevel) === -1) return false;
    if (exercise.minCandidates && candidates < exercise.minCandidates) return false;
    if (exercise.maxCandidates && candidates > exercise.maxCandidates) return false;

    if (search.length > 0) {
      var haystack = normalizeText([
        exercise.name,
        exercise.description,
        exercise.repetitions,
        exercise.teaches.join(" "),
        exercise.materials.map(function (key) { return MATERIAL_LABELS[key] || key; }).join(" ")
      ].join(" "));
      if (haystack.indexOf(search) === -1) return false;
    }

    if (exercise.materials.length > 0) {
      for (var i = 0; i < exercise.materials.length; i++) {
        if (!selectedMaterials.has(exercise.materials[i])) return false;
      }
    }
    return true;
  }

  function refreshFilteredExercises(options) {
    state.filtered = state.all.filter(exerciseMatchesFilters);
    ensureReserves();
    renderExercises();
    renderReserves();
    updateSummary();
    updateAddButtons();
    renderAiPrompt();
    if (!options || !options.quiet) saveState();
  }

  /* ---------------------------------------------------------------------------
   * Rendering: exercises
   * ------------------------------------------------------------------------ */

  function instructionsHtml(exercise) {
    var steps = buildGeneratedSteps(exercise);
    if (!steps || steps.length === 0) return "";
    var html = "<details class=\"lesson-builder-details\"><summary>Uitgebreide uitleg</summary><ol>";
    for (var i = 0; i < steps.length; i++) {
      html += "<li>" + escapeHtml(steps[i]) + "</li>";
    }
    html += "</ol></details>";
    return html;
  }

  function bomHtml(exercise) {
    var items = Array.isArray(exercise.bom) ? exercise.bom : [];
    if (items.length === 0) return "";
    var html = "<div class=\"lesson-builder-bom\"><strong>Benodigd materiaal</strong><ul>";
    for (var i = 0; i < items.length; i++) {
      html += "<li>" + escapeHtml(items[i]) + "</li>";
    }
    html += "</ul></div>";
    return html;
  }

  function teachesHtml(exercise) {
    if (!Array.isArray(exercise.teaches) || exercise.teaches.length === 0) return "";
    return "<span><strong>Leerdoel:</strong> " + escapeHtml(exercise.teaches.slice(0, 2).join(", ")) + "</span>";
  }

  function isBaseInPlan(baseId) {
    for (var i = 0; i < state.plan.length; i++) {
      if (state.plan[i].baseId === baseId) return true;
    }
    return false;
  }

  function renderExercises() {
    if (!exercisesEl) return;
    if (exerciseCountEl) {
      exerciseCountEl.textContent = state.filtered.length + " oefening" + (state.filtered.length === 1 ? "" : "en");
    }

    if (state.filtered.length === 0) {
      exercisesEl.innerHTML = "<p class=\"lesson-builder-empty\">Geen oefeningen gevonden voor deze filters. " +
        "Verruim je zoekterm, kies een ander niveau of selecteer meer materiaal.</p>";
      return;
    }

    var fragment = document.createDocumentFragment();
    for (var i = 0; i < state.filtered.length; i++) {
      var exercise = state.filtered[i];
      var card = document.createElement("article");
      card.className = "lesson-builder-card";

      var pills = "";
      if (exercise.isVariation) pills += " <span class=\"lesson-builder-pill\">variatie</span>";
      if (exercise.isCustom) pills += " <span class=\"lesson-builder-pill\">eigen</span>";

      card.innerHTML =
        "<h4>" + escapeHtml(exercise.name) + pills + "</h4>" +
        "<p>" + escapeHtml(exercise.description) + "</p>" +
        "<p class=\"lesson-builder-meta\">" +
          "<span><strong>Duur:</strong> " + exercise.durationMinutes + " min</span>" +
          "<span><strong>Type:</strong> " + sectionLabel(exercise.section) + "</span>" +
          "<span><strong>Niveau:</strong> " + escapeHtml(levelLabels(exercise.levels)) + "</span>" +
        "</p>" +
        "<p class=\"lesson-builder-meta\">" +
          "<span><strong>Kandidaten:</strong> min " + exercise.minCandidates +
            (exercise.maxCandidates ? ", max " + exercise.maxCandidates : "") + "</span>" +
          (exercise.repetitions ? "<span><strong>Herhaling:</strong> " + escapeHtml(exercise.repetitions) + "</span>" : "") +
          teachesHtml(exercise) +
        "</p>" +
        "<p class=\"lesson-builder-meta\">" +
          "<span><strong>Clubmateriaal:</strong> " + escapeHtml(materialLabels(exercise.materials)) + "</span>" +
          (exercise.setupEffort ? "<span><strong>Opbouw:</strong> " + escapeHtml(setupEffortLabel(exercise.setupEffort)) + "</span>" : "") +
        "</p>" +
        bomHtml(exercise) +
        instructionsHtml(exercise);

      var addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "lesson-builder-icon-action lesson-builder-add-btn";
      addButton.dataset.addExercise = exercise.id;
      addButton.innerHTML = "<i class=\"fa-solid fa-plus\" aria-hidden=\"true\"></i>";
      addButton.setAttribute("aria-label", "Voeg " + exercise.name + " toe");
      addButton.setAttribute("title", "Voeg toe");
      card.appendChild(addButton);
      fragment.appendChild(card);
    }
    exercisesEl.innerHTML = "";
    exercisesEl.appendChild(fragment);
    updateAddButtons();
  }

  function updateAddButtons() {
    if (!exercisesEl) return;
    var buttons = exercisesEl.querySelectorAll("[data-add-exercise]");
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      var exercise = state.all.find(function (item) { return item.id === button.dataset.addExercise; });
      if (!exercise) continue;
      var inPlan = isBaseInPlan(exercise.baseId);
      button.disabled = inPlan;
      button.classList.toggle("is-added", inPlan);
      button.innerHTML = inPlan
        ? "<i class=\"fa-solid fa-check\" aria-hidden=\"true\"></i>"
        : "<i class=\"fa-solid fa-plus\" aria-hidden=\"true\"></i>";
      button.setAttribute("aria-label", inPlan ? exercise.name + " staat al in de planning" : "Voeg " + exercise.name + " toe");
      button.setAttribute("title", inPlan ? "Al toegevoegd" : "Voeg toe");
    }
  }

  /* ---------------------------------------------------------------------------
   * Rendering: plan, reserves & summary
   * ------------------------------------------------------------------------ */

  function planTotal() {
    var total = 0;
    for (var i = 0; i < state.plan.length; i++) total += state.plan[i].durationMinutes;
    return total;
  }

  function schedulePlan(plan, startTime) {
    var cursor = timeToMinutes(startTime);
    return plan.map(function (exercise) {
      var start = cursor;
      cursor += exercise.durationMinutes;
      var copy = cloneExercise(exercise);
      copy.timeLabel = minutesToTime(start) + " - " + minutesToTime(cursor);
      copy.startMinutes = start;
      copy.endMinutes = cursor;
      return copy;
    });
  }

  function planActionButton(action, index, icon, label, extraClass, disabled) {
    return "<button type=\"button\" class=\"lesson-builder-action-btn " + (extraClass || "") + "\" " +
      "data-plan-action=\"" + action + "\" data-index=\"" + index + "\" " +
      (disabled ? "disabled " : "") +
      "aria-label=\"" + escapeHtml(label) + "\" title=\"" + escapeHtml(label) + "\">" +
      "<i class=\"fa-solid " + icon + "\" aria-hidden=\"true\"></i>" +
      "<span>" + escapeHtml(label) + "</span></button>";
  }

  function planCardHtml(exercise, index, isReserve) {
    var pills = "";
    if (exercise.isBuffer) pills += " <span class=\"lesson-builder-pill\">buffer</span>";
    if (exercise.isCustom) pills += " <span class=\"lesson-builder-pill\">eigen</span>";
    if (exercise.isVariation) pills += " <span class=\"lesson-builder-pill\">variatie</span>";

    var html = "<article class=\"lesson-builder-card " +
      (isReserve ? "lesson-builder-card-reserve" : "lesson-builder-card-selected") +
      (exercise.isBuffer ? " lesson-builder-card-buffer" : "") + "\">";
    html += "<h4>" + (isReserve ? "Reserve " + (index + 1) + " · " : (index + 1) + ". ") +
      escapeHtml(exercise.name) + pills + "</h4>";

    html += "<p class=\"lesson-builder-meta\">";
    if (!isReserve && exercise.timeLabel) {
      html += "<span><strong>Tijd:</strong> " + escapeHtml(exercise.timeLabel) + "</span>";
    }
    html += "<span><strong>Duur:</strong> " + exercise.durationMinutes + " min</span>" +
      "<span><strong>Type:</strong> " + sectionLabel(exercise.section) + "</span>" +
      "<span><strong>Niveau:</strong> " + escapeHtml(levelLabels(exercise.levels)) + "</span>" +
      "</p>";

    html += "<p class=\"lesson-builder-meta\">" +
      "<span><strong>Clubmateriaal:</strong> " + escapeHtml(materialLabels(exercise.materials)) + "</span>" +
      (exercise.setupEffort ? "<span><strong>Opbouw:</strong> " + escapeHtml(setupEffortLabel(exercise.setupEffort)) + "</span>" : "") +
      "</p>";

    if (isReserve) {
      html += "<div class=\"lesson-builder-plan-actions\">" +
        planActionButton("add-reserve", index, "fa-plus", "Voeg toe", "lesson-builder-action-add") +
        "</div>";
    } else {
      html += "<div class=\"lesson-builder-plan-actions\" role=\"group\" aria-label=\"Pas " +
        escapeHtml(exercise.name) + " aan\">" +
        planActionButton("up", index, "fa-arrow-up", "Omhoog", "", index === 0) +
        planActionButton("down", index, "fa-arrow-down", "Omlaag", "", index === state.plan.length - 1) +
        planActionButton("shorter", index, "fa-minus", "5 min korter", "", exercise.durationMinutes <= STEP_MINUTES) +
        planActionButton("longer", index, "fa-plus", "5 min langer", "", exercise.durationMinutes >= MAX_ITEM_MINUTES) +
        planActionButton("remove", index, "fa-trash-can", "Verwijder", "lesson-builder-action-remove", false) +
        "</div>";
    }

    if (isReserve) {
      html += "</article>";
      return html;
    }

    if (exercise.description) {
      html += "<p class=\"lesson-builder-long\">" + escapeHtml(exercise.description) + "</p>";
    }
    html += bomHtml(exercise);
    html += instructionsHtml(exercise);
    html += "</article>";
    return html;
  }

  function renderPlan() {
    if (!planEl) return;

    ensureReserves();
    updateAddButtons();

    if (state.plan.length === 0) {
      planEl.innerHTML = "<p class=\"lesson-builder-empty\">Nog geen oefeningen geselecteerd. " +
        "Klik op <strong>+</strong> bij een oefening of gebruik <strong>Genereer voorstel</strong>.</p>";
      updateSummary();
      renderReserves();
      return;
    }

    var scheduled = schedulePlan(state.plan, SESSION_START);
    var html = "";
    for (var i = 0; i < scheduled.length; i++) {
      html += planCardHtml(scheduled[i], i, false);
    }
    planEl.innerHTML = html;
    updateSummary();
    renderReserves();
  }

  function renderReserves() {
    if (!reservesEl) return;
    if (state.reserves.length === 0) {
      reservesEl.innerHTML = "<p class=\"lesson-builder-empty\">Geen reserve-oefeningen beschikbaar binnen deze filters.</p>";
      return;
    }
    var html = "";
    for (var i = 0; i < state.reserves.length; i++) {
      html += planCardHtml(state.reserves[i], i, true);
    }
    reservesEl.innerHTML = html;
  }

  function updateSummary() {
    var total = planTotal();
    var gap = SESSION_MINUTES - total;
    var end = total === 0
      ? minutesToTime(timeToMinutes(SESSION_START) + SESSION_MINUTES)
      : minutesToTime(timeToMinutes(SESSION_START) + total);

    if (totalMinutesEl) totalMinutesEl.textContent = String(total);
    if (endTimeEl) endTimeEl.textContent = end;
    if (planCountEl) planCountEl.textContent = state.plan.length + " item" + (state.plan.length === 1 ? "" : "s");

    if (summaryEl) {
      summaryEl.classList.remove("is-ok", "is-under", "is-over");
      if (gap === 0) summaryEl.classList.add("is-ok");
      else if (gap > 0) summaryEl.classList.add("is-under");
      else summaryEl.classList.add("is-over");
    }

    if (gapEl) {
      if (gap === 0) gapEl.textContent = "Perfect: de training vult exact 20:00–21:00.";
      else if (gap > 0) gapEl.textContent = "Nog " + gap + " min te vullen vóór 21:00.";
      else gapEl.textContent = Math.abs(gap) + " min over 21:00. Verkort of verwijder een oefening.";
    }

    var progress = Math.max(0, Math.min(100, (total / SESSION_MINUTES) * 100));
    if (progressBarEl) progressBarEl.style.width = progress + "%";
    if (progressEl) progressEl.setAttribute("aria-valuenow", String(Math.min(total, SESSION_MINUTES)));

    if (printMetaEl) {
      printMetaEl.textContent = "Start " + SESSION_START + " · einde " + end + " · " +
        state.plan.length + " oefeningen · " + total + " min";
    }

    updateWarnings();
  }

  function updateWarnings() {
    if (!warningsEl) return;
    var messages = [];
    if (state.plan.length > 0) {
      var selectedMaterials = getSelectedMaterials();
      var missingMaterials = [];
      for (var i = 0; i < state.plan.length; i++) {
        var materials = state.plan[i].materials || [];
        for (var j = 0; j < materials.length; j++) {
          if (!selectedMaterials.has(materials[j]) && missingMaterials.indexOf(materials[j]) === -1) {
            missingMaterials.push(materials[j]);
          }
        }
      }
      if (missingMaterials.length > 0) {
        messages.push("De planning gebruikt materiaal dat niet geselecteerd is: " + materialLabels(missingMaterials) + ".");
      }

      if (levelInput && levelInput.value !== "all") {
        var wrongLevel = state.plan.filter(function (exercise) {
          return !exercise.isBuffer && exercise.levels.length > 0 && exercise.levels.indexOf(levelInput.value) === -1;
        });
        if (wrongLevel.length > 0) {
          messages.push(wrongLevel.length + " oefening" + (wrongLevel.length === 1 ? " is" : "en zijn") +
            " niet voor niveau " + (LEVEL_LABELS[levelInput.value] || levelInput.value) + ".");
        }
      }

      var candidates = readCandidates();
      var wrongCandidates = state.plan.filter(function (exercise) {
        if (exercise.isBuffer) return false;
        return (exercise.minCandidates && candidates < exercise.minCandidates) ||
          (exercise.maxCandidates && candidates > exercise.maxCandidates);
      });
      if (wrongCandidates.length > 0) {
        messages.push(wrongCandidates.length + " oefening" + (wrongCandidates.length === 1 ? " past" : "en passen") +
          " niet bij " + candidates + " kandidaten.");
      }
    }

    warningsEl.hidden = messages.length === 0;
    warningsEl.textContent = messages.join(" ");
  }

  /* ---------------------------------------------------------------------------
   * Plan mutations
   * ------------------------------------------------------------------------ */

  function onAddExercise(ev) {
    var button = ev.target.closest("[data-add-exercise]");
    if (!button) return;
    var exercise = state.all.find(function (item) { return item.id === button.dataset.addExercise; });
    if (!exercise) return;
    if (isBaseInPlan(exercise.baseId)) {
      setStatus("Deze oefening staat al in de planning.");
      return;
    }
    state.plan.push(cloneExercise(exercise));
    saveState();
    renderPlan();
    setStatus(exercise.name + " toegevoegd. Totaal: " + planTotal() + " / " + SESSION_MINUTES + " min.");
  }

  function onPlanAction(ev) {
    var button = ev.target.closest("[data-plan-action]");
    if (!button) return;
    var index = parseInt(button.dataset.index, 10);
    if (isNaN(index)) return;
    var action = button.dataset.planAction;

    if (action === "remove") {
      var removed = state.plan.splice(index, 1)[0];
      setStatus((removed ? removed.name : "Oefening") + " verwijderd.");
    } else if (action === "up" && index > 0) {
      var previous = state.plan[index - 1];
      state.plan[index - 1] = state.plan[index];
      state.plan[index] = previous;
    } else if (action === "down" && index < state.plan.length - 1) {
      var next = state.plan[index + 1];
      state.plan[index + 1] = state.plan[index];
      state.plan[index] = next;
    } else if (action === "shorter") {
      adjustDuration(index, -STEP_MINUTES);
    } else if (action === "longer") {
      adjustDuration(index, STEP_MINUTES);
    }

    saveState();
    renderPlan();
  }

  function adjustDuration(index, delta) {
    var exercise = state.plan[index];
    if (!exercise) return;
    var next = exercise.durationMinutes + delta;
    if (next < MIN_ITEM_MINUTES) {
      state.plan.splice(index, 1);
      setStatus(exercise.name + " verwijderd omdat de duur te kort werd.");
      return;
    }
    exercise.durationMinutes = Math.min(MAX_ITEM_MINUTES, next);
  }

  function onReserveAction(ev) {
    var button = ev.target.closest("[data-plan-action='add-reserve']");
    if (!button) return;
    var index = parseInt(button.dataset.index, 10);
    var exercise = state.reserves[index];
    if (!exercise) return;
    state.plan.push(cloneExercise(exercise));
    saveState();
    renderPlan();
    setStatus(exercise.name + " als reserve toegevoegd. Totaal: " + planTotal() + " / " + SESSION_MINUTES + " min.");
  }

  function ensureReserves() {
    var used = new Set(state.plan.map(function (exercise) { return exercise.baseId; }));
    var candidates = state.filtered.filter(function (exercise) {
      return !used.has(exercise.baseId);
    });
    candidates.sort(function (a, b) {
      var sectionScoreA = a.section === "exercise" ? 0 : (a.section === "cooldown" ? 1 : 2);
      var sectionScoreB = b.section === "exercise" ? 0 : (b.section === "cooldown" ? 1 : 2);
      if (sectionScoreA !== sectionScoreB) return sectionScoreA - sectionScoreB;
      if (a.durationMinutes !== b.durationMinutes) return a.durationMinutes - b.durationMinutes;
      return a.name.localeCompare(b.name, "nl");
    });
    state.reserves = candidates.slice(0, 3);
  }

  /* ---------------------------------------------------------------------------
   * Proposal generator
   * ------------------------------------------------------------------------ */

  function shuffle(items) {
    var copy = items.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temporary = copy[i];
      copy[i] = copy[j];
      copy[j] = temporary;
    }
    return copy;
  }

  function randomPick(items) {
    if (!items || items.length === 0) return null;
    return items[Math.floor(Math.random() * items.length)];
  }

  function selectForBudget(items, budget) {
    if (budget <= 0 || items.length === 0) return [];
    var pool = shuffle(items);
    var dp = new Array(budget + 1);
    var preferredCount = Math.max(2, Math.min(6, Math.round(budget / 12)));
    dp[0] = [];

    for (var i = 0; i < pool.length; i++) {
      var item = pool[i];
      var duration = item.durationMinutes;
      if (duration > budget) continue;
      for (var minutes = budget; minutes >= duration; minutes--) {
        if (!dp[minutes - duration]) continue;
        var candidate = dp[minutes - duration].concat([item]);
        if (!dp[minutes] ||
            Math.abs(candidate.length - preferredCount) < Math.abs(dp[minutes].length - preferredCount)) {
          dp[minutes] = candidate;
        }
      }
    }

    for (var total = budget; total >= 0; total--) {
      if (dp[total]) return dp[total];
    }
    return [];
  }

  function createBuffer(minutes) {
    var duration = clamp(minutes, 1, SESSION_MINUTES);
    return {
      id: "buffer",
      baseId: "buffer",
      name: duration <= 5 ? "Buffer: nabespreking en materiaal" : "Buffer: vrije invulling",
      description: "Rustige nabespreking, feedback en het opruimen van materiaal. " +
        "Pas de duur aan of verwijder deze buffer als je liever een extra oefening inplant.",
      durationMinutes: duration,
      section: "buffer",
      repetitions: "",
      startTime: "",
      levels: [],
      minCandidates: 0,
      maxCandidates: null,
      isVariation: false,
      isCustom: false,
      isBuffer: true,
      variationOf: "",
      instructionSteps: [
        "Verzamel de groep en controleer of alle materiaal veilig opgeborgen is.",
        "Geef per buddy 1 concreet positief punt en 1 werkpunt voor de volgende training.",
        "Ruim gezamenlijk op en sluit af met een duidelijke OK-check."
      ],
      teaches: ["Nabespreking en materiaalbeheer"],
      materials: [],
      bom: ["Geen extra materiaal"],
      setupEffort: ""
    };
  }

  function generatePlan() {
    if (state.filtered.length === 0) {
      setStatus("Geen oefeningen beschikbaar om een voorstel te genereren.");
      return;
    }

    var basePool = state.filtered.filter(function (exercise) { return !exercise.isVariation; });
    if (basePool.length === 0) basePool = state.filtered.slice();

    var warmups = basePool.filter(function (exercise) { return exercise.section === "warmup"; });
    var mains = basePool.filter(function (exercise) { return exercise.section === "exercise"; });
    var cooldowns = basePool.filter(function (exercise) { return exercise.section === "cooldown"; });

    if (mains.length === 0) {
      setStatus("Geen hoofdoefeningen beschikbaar voor deze filters. Selecteer meer materiaal of een ander niveau.");
      return;
    }

    var plan = [];
    var used = new Set();

    var shortWarmups = warmups.filter(function (exercise) { return exercise.durationMinutes <= 10; });
    var warmupSource = randomPick(shortWarmups) || randomPick(warmups);
    var warmup = warmupSource ? cloneExercise(warmupSource) : null;
    if (warmup) {
      plan.push(warmup);
      used.add(warmup.baseId);
    }

    var shortCooldowns = cooldowns.filter(function (exercise) { return exercise.durationMinutes <= 10; });
    var cooldownSource = randomPick(shortCooldowns) || randomPick(cooldowns);
    var cooldown = cooldownSource ? cloneExercise(cooldownSource) : null;

    var warmupMinutes = warmup ? warmup.durationMinutes : 0;
    var cooldownMinutes = cooldown ? cooldown.durationMinutes : 0;
    var mainBudget = SESSION_MINUTES - warmupMinutes - cooldownMinutes;
    if (mainBudget < 5) mainBudget = SESSION_MINUTES - warmupMinutes;

    var availableMains = mains.filter(function (exercise) { return !used.has(exercise.baseId); });
    var selectedMains = selectForBudget(availableMains, mainBudget);
    for (var i = 0; i < selectedMains.length; i++) {
      plan.push(cloneExercise(selectedMains[i]));
      used.add(selectedMains[i].baseId);
    }

    if (cooldown && planTotalOf(plan) + cooldown.durationMinutes <= SESSION_MINUTES) {
      plan.push(cooldown);
    }

    var gap = SESSION_MINUTES - planTotalOf(plan);
    if (gap > 0) {
      plan.push(createBuffer(gap));
    }

    state.plan = plan;
    saveState();
    renderPlan();

    var total = planTotal();
    setStatus("Voorstel gemaakt: " + state.plan.length + " items, " + total + " / " + SESSION_MINUTES +
      " min (20:00–" + minutesToTime(timeToMinutes(SESSION_START) + total) + ").");
  }

  function planTotalOf(plan) {
    var total = 0;
    for (var i = 0; i < plan.length; i++) total += plan[i].durationMinutes;
    return total;
  }

  /* ---------------------------------------------------------------------------
   * AI prompt
   * ------------------------------------------------------------------------ */

  function absoluteUrl(path) {
    try {
      return new URL(path, window.location.href).href;
    } catch (error) {
      return path;
    }
  }

  function buildAiPrompt() {
    var topic = topicInput && topicInput.value.trim() ? topicInput.value.trim() : "vrije keuze (algemene training)";
    var materials = getSelectedMaterials();
    var materialText = materials.size === materialCheckboxes.length
      ? "alle beschikbare clubmaterialen"
      : (materials.size === 0 ? "geen extra materiaal" : Array.from(materials).map(function (key) {
        return MATERIAL_LABELS[key] || key;
      }).join(", "));

    return [
      "Je bent een ervaren duikinstructeur bij VUB Diving Center.",
      "",
      "Lees eerst de volledige lesplan-instructies:",
      absoluteUrl("/les-samenstellen/ai/lesplan-instructies.md"),
      "",
      "Gebruik als bron:",
      "- Volledig oefeningenbestand: " + absoluteUrl(DATA_URL),
      "- Leesbare oefeningenlijst: " + absoluteUrl("/les-samenstellen/oefeningen/"),
      "",
      "FILTERS",
      "- Niveau: " + levelFilterLabel(),
      "- Aantal kandidaten: " + readCandidates(),
      "- Beschikbaar materiaal: " + materialText,
      "- Thema/focus: " + topic,
      "",
      "Maak een lesvoorstel op basis van de filters. Gebruik bij voorkeur bestaande oefeningen uit de lijst.",
      "",
      "Gebruik dit voorbeeld als startpunt en pas het aan op het thema en de filters:",
      "",
      "Titel: [thema] — 60 minuten",
      "Tijd | Oefening | Duur | Materiaal | Uitleg",
      "20:00–20:10 | Opwarming met basismateriaal | 10 min | Basismateriaal | Rustig tempo en ademhaling.",
      "20:10–20:30 | [thema-oefening 1] | 20 min | [materiaal] | [korte uitleg]",
      "20:30–20:50 | [thema-oefening 2] | 20 min | [materiaal] | [korte uitleg]",
      "20:50–21:00 | Afsluiter en debrief | 10 min | Geen extra | Feedback en materiaalcontrole.",
      "Totaal: 60 minuten · einde 21:00",
      "Reserve: [reserve-oefening]"
    ].join("\n");
  }

  function renderAiPrompt() {
    if (!aiPromptEl) return;
    if (!state.dataLoaded) return;
    aiPromptEl.textContent = buildAiPrompt();
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "readonly");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        var ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (ok) resolve();
        else reject(new Error("Kopiëren niet ondersteund"));
      } catch (error) {
        document.body.removeChild(textarea);
        reject(error);
      }
    });
  }

  function setAiStatus(message) {
    if (aiStatusEl) aiStatusEl.textContent = message || "";
  }

  function onCopyAiPrompt() {
    var prompt = buildAiPrompt();
    copyText(prompt).then(function () {
      setAiStatus("AI-opdracht gekopieerd. Plak hem in ChatGPT, Claude of een andere AI.");
    }).catch(function () {
      setAiStatus("Kopiëren lukte niet. Selecteer de tekst hieronder en kopieer handmatig.");
    });
  }

  /* ---------------------------------------------------------------------------
   * Persistence
   * ------------------------------------------------------------------------ */

  function saveState() {
    if (!state.dataLoaded) return;
    try {
      var materials = [];
      for (var i = 0; i < materialCheckboxes.length; i++) {
        if (materialCheckboxes[i].checked) materials.push(materialCheckboxes[i].dataset.materialKey);
      }
      var payload = {
        version: 2,
        filters: {
          level: levelInput ? levelInput.value : "all",
          candidates: readCandidates(),
          search: searchInput ? searchInput.value : "",
          topic: topicInput ? topicInput.value : "",
          materials: materials,
          variations: showsVariations()
        },
        plan: state.plan.map(cloneExercise)
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      /* localStorage kan geblokkeerd zijn */
    }
  }

  function restoreFilters() {
    var saved = null;
    try {
      saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    } catch (error) {
      saved = null;
    }
    if (!saved || !saved.filters) return;
    var filters = saved.filters;

    if (levelInput && filters.level) {
      var levelExists = false;
      for (var i = 0; i < levelInput.options.length; i++) {
        if (levelInput.options[i].value === filters.level) levelExists = true;
      }
      if (levelExists) levelInput.value = filters.level;
    }
    if (candidatesInput && filters.candidates) {
      candidatesInput.value = String(clamp(filters.candidates, 1, MAX_CANDIDATES));
    }
    if (searchInput && typeof filters.search === "string") searchInput.value = filters.search;
    if (topicInput && typeof filters.topic === "string") topicInput.value = filters.topic;
    if (variationsInput) variationsInput.checked = !!filters.variations;

    if (Array.isArray(filters.materials)) {
      for (var j = 0; j < materialCheckboxes.length; j++) {
        materialCheckboxes[j].checked = filters.materials.indexOf(materialCheckboxes[j].dataset.materialKey) >= 0;
      }
    }
  }

  function sanitizeStoredPlanItem(item) {
    if (!item || typeof item !== "object") return null;
    if (!item.name) return null;
    var clean = cloneExercise(item);
    clean.durationMinutes = clamp(clean.durationMinutes, MIN_ITEM_MINUTES, MAX_ITEM_MINUTES);
    if (clean.isBuffer) {
      clean.id = "buffer";
      clean.baseId = "buffer";
    } else {
      clean.id = String(clean.id || "stored/" + slugify(clean.name));
      clean.baseId = String(clean.baseId || clean.id);
    }
    clean.section = normalizeSection(clean.section);
    return clean;
  }

  function restorePlan() {
    var saved = null;
    try {
      saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    } catch (error) {
      saved = null;
    }
    if (!saved || !Array.isArray(saved.plan) || saved.plan.length === 0) return false;

    var restored = [];
    for (var i = 0; i < saved.plan.length; i++) {
      var item = sanitizeStoredPlanItem(saved.plan[i]);
      if (item) restored.push(item);
    }
    if (restored.length === 0) return false;

    state.plan = restored;
    state.restored = true;
    renderPlan();
    return true;
  }

  /* ---------------------------------------------------------------------------
   * Printing
   * ------------------------------------------------------------------------ */

  function buildPrintPayload() {
    var scheduled = schedulePlan(state.plan, SESSION_START);
    var total = planTotal();
    return {
      version: 2,
      createdAt: new Date().toISOString(),
      session: {
        startTime: SESSION_START,
        endTime: minutesToTime(timeToMinutes(SESSION_START) + total),
        totalMinutes: total,
        targetMinutes: SESSION_MINUTES,
        level: levelInput ? levelInput.value : "all",
        levelLabel: levelFilterLabel(),
        candidates: readCandidates(),
        topic: topicInput ? topicInput.value.trim() : ""
      },
      totalMinutes: total,
      plan: scheduled.map(function (exercise, index) {
        return {
          index: index + 1,
          name: exercise.name,
          durationMinutes: exercise.durationMinutes,
          section: sectionLabel(exercise.section),
          sectionKey: exercise.section,
          timeLabel: exercise.timeLabel,
          description: exercise.description,
          materials: exercise.bom,
          materialKeys: exercise.materials,
          steps: buildGeneratedSteps(exercise),
          repetitions: exercise.repetitions,
          levels: levelLabels(exercise.levels),
          setupEffort: setupEffortLabel(exercise.setupEffort),
          isBuffer: exercise.isBuffer
        };
      }),
      reserves: state.reserves.map(function (exercise) {
        return {
          name: exercise.name,
          durationMinutes: exercise.durationMinutes,
          section: sectionLabel(exercise.section),
          description: exercise.description,
          materials: exercise.bom,
          steps: buildGeneratedSteps(exercise)
        };
      })
    };
  }

  function utf8ToBase64(value) {
    if (typeof TextEncoder !== "undefined") {
      var bytes = new TextEncoder().encode(value);
      var binary = "";
      var chunk = 0x8000;
      for (var i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return btoa(binary);
    }
    return btoa(unescape(encodeURIComponent(value)));
  }

  function onPrint() {
    if (state.plan.length === 0) {
      setStatus("Maak eerst een planning voor je print/PDF opent.");
      return;
    }

    var payload = buildPrintPayload();
    var json = JSON.stringify(payload);
    var storageOk = false;
    try {
      window.sessionStorage.setItem(PRINT_KEY, json);
      window.localStorage.setItem(PRINT_KEY, json);
      storageOk = true;
    } catch (error) {
      storageOk = false;
    }

    if (storageOk) {
      window.location.href = "/les-samenstellen/print/";
      return;
    }

    try {
      window.location.href = "/les-samenstellen/print/?data=" + encodeURIComponent(utf8ToBase64(json));
    } catch (error) {
      setStatus("Kon printdata niet doorgeven voor print/PDF.");
    }
  }

  /* ---------------------------------------------------------------------------
   * UI events
   * ------------------------------------------------------------------------ */

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message || "";
  }

  function updateMaterialToggleLabel() {
    if (!materialToggleButton) return;
    var selectedCount = getSelectedMaterials().size;
    var totalCount = materialCheckboxes.length;
    if (selectedCount === totalCount) {
      materialToggleButton.textContent = "Alle materiaal geselecteerd";
    } else if (selectedCount === 0) {
      materialToggleButton.textContent = "Geen materiaal geselecteerd";
    } else {
      materialToggleButton.textContent = selectedCount + " / " + totalCount + " materiaal geselecteerd";
    }
  }

  function closeMaterialsPanel() {
    if (!materialsPanel || !materialToggleButton) return;
    materialsPanel.hidden = true;
    materialToggleButton.setAttribute("aria-expanded", "false");
  }

  var filterTimer = null;
  function scheduleFilterUpdate() {
    if (filterTimer) window.clearTimeout(filterTimer);
    filterTimer = window.setTimeout(function () {
      refreshFilteredExercises();
      setStatus("Filters toegepast: " + state.filtered.length + " oefeningen beschikbaar.");
    }, 120);
  }

  function onFilterChanged() {
    updateMaterialToggleLabel();
    refreshFilteredExercises();
    setStatus("Filters toegepast: " + state.filtered.length + " oefeningen beschikbaar.");
  }

  function bindEvents() {
    if (levelInput) levelInput.addEventListener("change", onFilterChanged);
    if (candidatesInput) {
      candidatesInput.addEventListener("input", scheduleFilterUpdate);
      candidatesInput.addEventListener("change", function () {
        candidatesInput.value = String(readCandidates());
        onFilterChanged();
      });
    }
    if (searchInput) searchInput.addEventListener("input", scheduleFilterUpdate);
    if (topicInput) topicInput.addEventListener("input", function () {
      renderAiPrompt();
      saveState();
    });
    if (variationsInput) variationsInput.addEventListener("change", onFilterChanged);
    for (var i = 0; i < materialCheckboxes.length; i++) {
      materialCheckboxes[i].addEventListener("change", onFilterChanged);
    }

    if (materialAllButton) {
      materialAllButton.addEventListener("click", function () {
        for (var i = 0; i < materialCheckboxes.length; i++) materialCheckboxes[i].checked = true;
        onFilterChanged();
      });
    }
    if (materialNoneButton) {
      materialNoneButton.addEventListener("click", function () {
        for (var i = 0; i < materialCheckboxes.length; i++) materialCheckboxes[i].checked = false;
        onFilterChanged();
      });
    }

    if (materialToggleButton && materialsPanel) {
      materialToggleButton.setAttribute("aria-expanded", "false");
      materialToggleButton.addEventListener("click", function () {
        materialsPanel.hidden = !materialsPanel.hidden;
        materialToggleButton.setAttribute("aria-expanded", materialsPanel.hidden ? "false" : "true");
      });
      document.addEventListener("click", function (ev) {
        if (materialsPanel.hidden) return;
        if (ev.target === materialToggleButton) return;
        if (materialsPanel.contains(ev.target)) return;
        closeMaterialsPanel();
      });
      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && !materialsPanel.hidden) closeMaterialsPanel();
      });
    }

    if (exercisesEl) exercisesEl.addEventListener("click", onAddExercise);
    if (planEl) planEl.addEventListener("click", onPlanAction);
    if (reservesEl) reservesEl.addEventListener("click", onReserveAction);

    if (generateButton) generateButton.addEventListener("click", generatePlan);
    if (printButton) printButton.addEventListener("click", onPrint);
    if (clearButton) {
      clearButton.addEventListener("click", function () {
        if (state.plan.length > 0 && !window.confirm("Planning leegmaken? Dit kan niet ongedaan worden gemaakt.")) return;
        state.plan = [];
        saveState();
        renderPlan();
        setStatus("Planning geleegd.");
      });
    }

    if (aiCopyButton) aiCopyButton.addEventListener("click", onCopyAiPrompt);
    if (aiDetails) {
      aiDetails.addEventListener("toggle", function () {
        if (aiDetails.open) renderAiPrompt();
      });
    }
  }

  /* ---------------------------------------------------------------------------
   * Init
   * ------------------------------------------------------------------------ */

  function init(exercises, materials) {
    state.all = createVariations(exercises);
    applyMaterialSet(materials);
    state.dataLoaded = true;
    restoreFilters();
    bindEvents();
    updateMaterialToggleLabel();
    refreshFilteredExercises({ quiet: true });
    var restored = restorePlan();
    if (!restored) renderPlan();
    renderAiPrompt();

    if (restored) {
      setStatus("Vorige planning hersteld (" + state.plan.length + " items, " + planTotal() + " / " + SESSION_MINUTES + " min).");
    } else {
      setStatus("Data geladen: " + exercises.length + " basisoefeningen. Kies je filters en genereer een voorstel.");
    }
  }

  window.fetch(DATA_URL, { cache: "no-cache" })
    .then(function (response) {
      if (!response.ok) throw new Error("Kon oefenbestand niet laden (HTTP " + response.status + ")");
      return response.json();
    })
    .then(function (data) {
      var graph = Array.isArray(data["@graph"]) ? data["@graph"] : [];
      var exercises = graph
        .map(normalizeExercise)
        .filter(function (exercise) { return !!exercise; });
      if (exercises.length === 0) throw new Error("Geen oefeningen gevonden in het oefenbestand");
      init(exercises, extractMaterialSet(graph));
    })
    .catch(function (error) {
      setStatus("Fout bij laden van oefeningen: " + error.message);
      if (exercisesEl) {
        exercisesEl.innerHTML = "<p class=\"lesson-builder-empty\">De oefeningen konden niet geladen worden. " +
          "Herlaad de pagina of probeer het later opnieuw.</p>";
      }
    });
})();
