export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Gibt true zurück wenn Manus-OAuth konfiguriert ist (Online-Modus).
 * Im lokalen Container-Betrieb ist VITE_OAUTH_PORTAL_URL leer → false.
 */
export const isOAuthConfigured = (): boolean => {
  const url = import.meta.env.VITE_OAUTH_PORTAL_URL;
  return typeof url === "string" && url.length > 0;
};

/**
 * Erzeugt die Login-URL für Manus-OAuth.
 * Gibt "#" zurück wenn OAuth nicht konfiguriert ist (lokaler Betrieb).
 */
export const getLoginUrl = (returnPath?: string): string => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;

  // Lokaler Modus: OAuth nicht konfiguriert → kein Login nötig
  if (!oauthPortalUrl || !appId) {
    return "#";
  }

  try {
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const state = btoa(
      JSON.stringify({ redirectUri, returnPath: returnPath ?? "/" })
    );

    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch {
    return "#";
  }
};
