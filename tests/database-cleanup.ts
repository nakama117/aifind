import postgres from "postgres";

// Fixture CREATE/DROP DATABASE can overlap checkpoint/process-barrier work on Windows
// PostgreSQL17. Serialize this DDL only; invariant files still run six at once.
async function databaseOperation(databaseUrl: string, name: string, kind: "create" | "drop", sourceTemplate?: string): Promise<void> {
  const url = new URL(databaseUrl);
  const template = decodeURIComponent(url.pathname.slice(1));
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      !/^[a-z0-9_]+_(test|ci)$/i.test(template) || url.search !== "") {
    throw new Error("cleanup requires a local test database URL");
  }
  // The existing sourced-news fixture is deliberately named *_preview for seed-preview.ts.
  if ((kind === "drop" && name === template) ||
      (!/^[a-z0-9_]+_(test|ci)$/i.test(name) && name !== `news_${process.pid}_preview`) ||
      (sourceTemplate !== undefined && !/^[a-z0-9_]+_(test|ci)$/i.test(sourceTemplate))) {
    throw new Error("invalid test database target");
  }
  url.pathname = "/postgres";
  const admin = postgres(url.href, { max: 1, onnotice: () => {} });
  try {
    await admin`SELECT pg_advisory_lock(69427, 17005)`;
    try {
      if (kind === "drop") await admin`DROP DATABASE IF EXISTS ${admin(name)} WITH (FORCE)`;
      else if (sourceTemplate) await admin`CREATE DATABASE ${admin(name)} TEMPLATE ${admin(sourceTemplate)}`;
      else await admin`CREATE DATABASE ${admin(name)}`;
    }
    finally { await admin`SELECT pg_advisory_unlock(69427, 17005)`; }
  } finally { await admin.end(); }
}

export const dropTestDatabase = (databaseUrl: string, name: string) => databaseOperation(databaseUrl, name, "drop");
export const createTestDatabase = (databaseUrl: string, name: string, template?: string) => databaseOperation(databaseUrl, name, "create", template);
