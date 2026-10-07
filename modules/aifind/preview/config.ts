export const previewEnabled = () => process.env.AIFIND_PREVIEW_ENABLED === "true";

/** Demo writes are opt-in, local, disposable and never allowed in production. */
export function assertPreviewWrites(env: NodeJS.ProcessEnv): void {
  if (env.AIFIND_PREVIEW_ENABLED !== "true") throw new Error("Preview requires AIFIND_PREVIEW_ENABLED=true");
  if (env.NODE_ENV === "production" || env.AIHOT_ENVIRONMENT === "production") throw new Error("Preview demo writes are forbidden in production");
  const url = new URL(env.DATABASE_URL ?? "postgres://unset/unset");
  // postgres forwards URL parameters in its startup message, including a database override.
  if (url.search) throw new Error("Preview database URLs must not contain connection override parameters");
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      || !/^\/[a-zA-Z0-9_]+_(preview|test|ci)$/.test(url.pathname)) {
    throw new Error("Preview demo writes require a local *_preview, *_test or *_ci database");
  }
}
