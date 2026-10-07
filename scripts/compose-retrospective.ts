// Explicit historical editions use source publication dates, not a fabricated delivery history.
// Dry run by default. Existing issues are retained; ordinary scheduled editions are unchanged.
import { parseArgs } from "node:util";
import { addDays, isoWeekLabel, isoWeekRange, monthRange, tokyoDate, tokyoMidnight } from "@aihot/contracts/time";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { composeDaily, composeWeekly, composeMonthly } from "@aihot/backend/reports/compose";

const { values } = parseArgs({ options: { from: { type: "string" }, to: { type: "string" }, apply: { type: "boolean", default: false }, periods: { type: "boolean", default: false } } });
const validDay = (day: string | undefined): day is string => !!day && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().startsWith(day);
if (!validDay(values.from) || !validDay(values.to) || values.from > values.to) throw new Error("Provide --from YYYY-MM-DD --to YYYY-MM-DD (inclusive issue dates)");
const lastEnd = tokyoMidnight(values.to).getTime() + 8 * 3600_000;
if (lastEnd > Date.now()) throw new Error("A retrospective window must have ended");
if ((lastEnd - tokyoMidnight(values.from).getTime()) / 86400_000 > 366) throw new Error("Import at most one year per explicit run");

try {
  const days: string[] = [];
  for (let day = values.from; day <= values.to; day = addDays(day, 1)) days.push(day);
  const eligible = await sql`SELECT count(*)::int AS articles FROM publications WHERE visibility='public' AND eligible AND selected AND visible_after<=now() AND published_at>=${new Date(tokyoMidnight(values.from).getTime() - 16 * 3600_000)} AND published_at<${new Date(lastEnd)}`;
  console.log(JSON.stringify({ apply: values.apply, from: values.from, to: values.to, ...eligible[0] }));
  if (values.apply) {
    for (const date of days) {
      try { console.log(JSON.stringify({ kind: "daily", ...await composeDaily(date, undefined, { retrospective: true }) })); }
      catch (error) {
        if (!String(error).includes("no selected items")) throw error;
        console.log(JSON.stringify({ kind: "daily", key: date, skipped: "no selected items" }));
      }
    }
    if (values.periods) {
      const today = tokyoDate(new Date());
      for (const key of new Set(days.map(isoWeekLabel))) {
        if (isoWeekRange(key)!.end >= today) continue;
        try { console.log(JSON.stringify({ kind: "weekly", ...await composeWeekly(key) })); }
        catch (error) { if (!String(error).includes("no daily entries")) throw error; }
      }
      for (const key of new Set(days.map((day) => day.slice(0, 7)))) {
        if (monthRange(key)!.end >= today) continue;
        try { console.log(JSON.stringify({ kind: "monthly", ...await composeMonthly(key) })); }
        catch (error) { if (!String(error).includes("no daily entries")) throw error; }
      }
    }
  }
} finally { await stopBoss(); await closeDb(); }
