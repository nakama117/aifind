import type postgres from "postgres";

/** Must run before migrations as well as before seeding an existing preview database. */
export async function assertOnlyPreviewMaterial(db: postgres.Sql): Promise<void> {
  const [table] = await db`SELECT to_regclass('public.articles') AS name`;
  if (!table!.name) return;
  const [row] = await db`SELECT count(*)::int AS n FROM articles WHERE source_id NOT LIKE 'preview-%'`;
  if (Number(row!.n) > 0) throw new Error("Preview database contains non-preview material; choose an empty *_preview DB");
}

/** Preview imports may only be written to an explicitly named local preview DB. */
export function previewEnvironment(databaseUrl: string, inherited: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !/^\/[a-zA-Z0-9_]+_preview$/.test(url.pathname)) {
    throw new Error("Preview requires a local PostgreSQL database whose name ends with _preview");
  }
  const env: NodeJS.ProcessEnv = {
    ...inherited, DATABASE_URL: databaseUrl, NODE_ENV: "production", AIHOT_ENVIRONMENT: "preview",
    SITE_URL: "http://127.0.0.1:3100", API_BASE_URL: "http://127.0.0.1:3101",
    WEB_HOST: "127.0.0.1", WEB_PORT: "3100", API_HOST: "127.0.0.1", API_PORT: "3101",
    SITE_PREVIEW: "true", TRUST_PROXY: "false", COLLECT_ENABLED: "false", MODEL_CALLS_ENABLED: "false",
    FEISHU_CONTENT_PUSH_ENABLED: "false", FEISHU_INTERNAL_ENABLED: "false", INDEXNOW_SUBMIT_ENABLED: "false",
    ALLOW_PRIVATE_NETWORK_FETCH: "false",
  };
  delete env.DEV_AUTH_ROLE;
  delete env.DEV_AUTH_DISPLAY_NAME;
  return env;
}
