import fs from "fs";
import { DateTime } from "luxon";

/**
 * Inschrijvingen voor de initiatieles blijven open tot GRACE_HOURS na de les.
 * Daarna wordt de knop op /initiatie/ verborgen en stuurt /registration/initiatie/
 * de bezoeker door naar /initiatie/.
 */
const GRACE_HOURS = 24;
const ZONE = "Europe/Brussels";

const DATE_FORMATS = [
  "d LLLL yyyy",
  "cccc d LLLL yyyy",
  "cccc, d LLLL yyyy",
  "d LLL yyyy",
  "d/L/yyyy",
];

const vdc = JSON.parse(fs.readFileSync("./_data/vdc.json", "utf8"));

/**
 * Zet de leesbare datum ("2 oktober 2026") en het uur ("19u30") om naar een
 * datum/tijd. Geeft null terug als de datum niet leesbaar is (bv. "Te bepalen").
 */
function parseStart(datum, uur) {
  const date = String(datum || "").trim();
  if (!date) return null;

  let dt = DateTime.fromISO(date, { zone: ZONE });
  for (const format of DATE_FORMATS) {
    if (dt.isValid) break;
    dt = DateTime.fromFormat(date, format, { locale: "nl", zone: ZONE });
  }
  if (!dt.isValid) return null;

  const time = /^\s*(\d{1,2})\s*[u:.]?\s*(\d{2})?/.exec(String(uur || ""));
  if (time) {
    dt = dt.set({ hour: Number(time[1]), minute: Number(time[2] || 0) });
  }
  return dt;
}

const start = parseStart(vdc.initiatieles.datum, vdc.initiatieles.uur);

if (!start) {
  console.warn(
    `[initiatie] Datum "${vdc.initiatieles.datum}" is niet leesbaar: inschrijving voor de initiatieles wordt verborgen.`
  );
}

const cutoff = start ? start.plus({ hours: GRACE_HOURS }) : null;

export default {
  graceHours: GRACE_HOURS,
  scheduled: Boolean(start),
  start: start ? start.toISO() : null,
  cutoff: cutoff ? cutoff.toISO() : null,
  open: Boolean(cutoff) && DateTime.now().setZone(ZONE) < cutoff,
};
