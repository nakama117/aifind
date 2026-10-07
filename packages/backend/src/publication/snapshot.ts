import { sql, type Tx } from "../db.ts";

/** Module public projections share the publication layer's coherent, read-only snapshot boundary. */
export function readPublishedSnapshot<T>(read: (db: Tx) => Promise<T>): Promise<T> {
  return sql.begin("isolation level repeatable read read only", read) as Promise<T>;
}
