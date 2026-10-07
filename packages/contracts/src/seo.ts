/** These public ownership-verification values are the only environment tokens sent to page HTML. */
export function searchVerification(env: Record<string, string | undefined>) {
  const token = (value: string | undefined) => {
    const text = value?.trim() ?? "";
    return /^[A-Za-z0-9_-]{1,512}$/.test(text) && !text.startsWith("sk-") ? text : null;
  };
  return { google: token(env.GOOGLE_SITE_VERIFICATION), bing: token(env.BING_SITE_VERIFICATION) };
}
