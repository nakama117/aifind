// Run inside the worker container. Uses the same paired backup and receipts as the scheduled task.
import { runBackup } from "@aihot/backend/operations/backup";
import { closeDb } from "@aihot/backend/db";
try { console.log(JSON.stringify(await runBackup(), null, 2)); }
finally { await closeDb(); }
