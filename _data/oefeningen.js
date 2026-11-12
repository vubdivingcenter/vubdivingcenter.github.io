import fs from "node:fs";

const DATA_FILE = "./scripts/data/vdc-oefeningen.jsonld";

const SECTION_LABELS = {
  warmup: "Opwarming",
  exercise: "Hoofdoefeningen",
  cooldown: "Afsluiters",
  buffer: "Buffer"
};

const LEVEL_LABELS = {
  initiate: "Initiatie",
  graduate: "Gevorderd",
  bachelor: "Bachelor"
};

function getAdditionalProperty(item, name) {
  if (!item || !Array.isArray(item.additionalProperty)) return "";
  const property = item.additionalProperty.find((entry) => entry && entry.name === name);
  return property ? String(property.value || "") : "";
}

function parseDurationMinutes(value) {
  if (!value) return 0;
  const match = String(value).match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if (!match) return 0;
  return parseInt(match[1] || "0", 10) * 60 + parseInt(match[2] || "0", 10);
}

function parseList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function parseSteps(item) {
  if (!Array.isArray(item.step)) return [];
  return item.step
    .map((step) => {
      if (typeof step === "string") return step;
      if (step && typeof step.text === "string") return step.text;
      if (step && typeof step.name === "string") return step.name;
      return "";
    })
    .filter(Boolean);
}

function parseTeaches(item) {
  if (!Array.isArray(item.teaches)) return [];
  return item.teaches
    .map((term) => {
      if (typeof term === "string") return term;
      return term && term.name ? String(term.name) : "";
    })
    .filter(Boolean);
}

function parseMaterials(item) {
  if (!Array.isArray(item.supply)) return [];
  return item.supply
    .map((supply) => {
      if (typeof supply === "string") return supply.trim();
      return supply && supply.name ? String(supply.name).trim() : "";
    })
    .filter(Boolean);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalize(item) {
  const levels = parseList(getAdditionalProperty(item, "difficulty"));
  if (levels.length === 0 && item.audience && item.audience.audienceType) {
    levels.push(...parseList(item.audience.audienceType));
  }
  const section = getAdditionalProperty(item, "section") || "exercise";
  const id = String(item["@id"] || "");
  const lastPart = id.split("/").filter(Boolean).pop() || item.name || "oefening";
  const minCandidates = parseInt(getAdditionalProperty(item, "minCandidates") || "1", 10);
  const maxCandidatesRaw = getAdditionalProperty(item, "maxCandidates");
  const maxCandidates = maxCandidatesRaw ? parseInt(maxCandidatesRaw, 10) : null;
  const materials = parseMaterials(item);

  return {
    id,
    slug: slugify(lastPart),
    name: item.name || "Naamloze oefening",
    description: item.description || "",
    durationMinutes: parseDurationMinutes(item.activityDuration) || 10,
    section,
    sectionLabel: SECTION_LABELS[section] || SECTION_LABELS.exercise,
    levels,
    levelLabel: levels.length > 0
      ? levels.map((level) => LEVEL_LABELS[level] || level).join(", ")
      : "n.v.t.",
    minCandidates: isNaN(minCandidates) ? 1 : minCandidates,
    maxCandidates: isNaN(maxCandidates) ? null : maxCandidates,
    repetitions: getAdditionalProperty(item, "repetitions"),
    setupEffort: getAdditionalProperty(item, "setupEffort"),
    materials,
    teaches: parseTeaches(item),
    steps: parseSteps(item)
  };
}

function parseMaterialSet(graph) {
  const termSet = graph.find(
    (item) => item && item["@type"] === "DefinedTermSet" && Array.isArray(item.hasDefinedTerm)
  );
  if (!termSet) return [];
  return termSet.hasDefinedTerm
    .map((term) => ({
      key: String(term.termCode || term.identifier || slugify(term.name || "")),
      label: String(term.name || term.termCode || "")
    }))
    .filter((material) => material.key && material.label);
}

export default function () {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const graph = Array.isArray(data["@graph"]) ? data["@graph"] : [];
  const exercises = graph
    .filter((item) => item && item["@type"] === "ExercisePlan")
    .map(normalize)
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));

  const order = ["warmup", "exercise", "cooldown", "buffer"];
  const groups = order
    .map((key) => ({
      key,
      label: SECTION_LABELS[key] || key,
      items: exercises.filter((exercise) => exercise.section === key)
    }))
    .filter((group) => group.items.length > 0);

  return {
    all: exercises,
    groups,
    count: exercises.length,
    materials: parseMaterialSet(graph)
  };
}
