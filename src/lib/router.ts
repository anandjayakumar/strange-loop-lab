/**
 * Tiny history router for the four top-level sections.
 *
 * Clean paths (/research, /findings, /paper) are the default. When the app is
 * opened from the filesystem, or hosted somewhere without an SPA fallback, the
 * same routes also work as hash paths (#/research?version=v03). Direct links,
 * reloads and browser back/forward all resolve through `parseRoute`.
 */

export type RouteName = "home" | "research" | "findings" | "paper";

export type VersionId = "v0" | "v02" | "v03" | "v04" | "v05";

export interface RouteState {
  name: RouteName;
  version: VersionId;
  /** In-page section id without the leading '#'. */
  hash: string;
}

export const VERSION_IDS: VersionId[] = ["v0", "v02", "v03", "v04", "v05"];

const NAV_EVENT = "strange-loop:navigate";

const isVersion = (value: string | null | undefined): value is VersionId =>
  !!value && (VERSION_IDS as string[]).includes(value);

export const buildResearchHref = (version: VersionId) =>
  version === "v0" ? "/research?version=v0" : `/research?version=${version}`;

/** Maps the legacy view targets used inside the labs onto real URLs. */
export function resolveHref(target: string): string {
  if (target.startsWith("/") || target.startsWith("#")) return target;
  switch (target) {
    case "home":
      return "/";
    case "research":
      return "/research";
    case "findings":
      return "/findings";
    case "paper":
      return "/paper";
    case "v0":
      return buildResearchHref("v0");
    case "v02":
    case "v03":
    case "v04":
    case "v05":
      return buildResearchHref(target);
    default:
      return "/";
  }
}

/** Hash routing is required on file:// URLs, which cannot push clean paths. */
export const usesHashRouting = () =>
  typeof window !== "undefined" && window.location.protocol === "file:";

export function hrefFor(target: string): string {
  const href = resolveHref(target);
  if (!usesHashRouting()) return href;
  // `#/research?version=v03` keeps the document on index.html.
  return href.startsWith("#") ? href : `#${href}`;
}

export function parseRoute(location: Location = window.location): RouteState {
  let pathname = location.pathname || "/";
  let search = location.search || "";
  const rawHash = location.hash || "";
  let hashSection = "";

  // Hash fallback: #/research?version=v03 or #/findings#matrix
  if ((pathname === "/" || pathname === "/index.html") && rawHash.startsWith("#/")) {
    const body = rawHash.slice(1);
    const [hashPath, hashQuery] = body.split("?");
    const [routePath, section] = (hashPath || "/").split("#");
    pathname = routePath || "/";
    search = hashQuery ? `?${hashQuery}` : "";
    hashSection = section ?? "";
  }

  const path = pathname.replace(/\/+$/, "").toLowerCase() || "/";
  const params = new URLSearchParams(search);
  const requestedVersion = params.get("version")?.toLowerCase();
  const version: VersionId = isVersion(requestedVersion) ? requestedVersion : "v0";

  let name: RouteName = "home";
  if (path === "/research") name = "research";
  else if (path === "/findings") name = "findings";
  else if (path === "/paper") name = "paper";

  const hash =
    hashSection || (rawHash && !rawHash.startsWith("#/") ? rawHash.slice(1) : "");

  return { name, version, hash };
}

export function navigateTo(target: string, options: { replace?: boolean } = {}) {
  const href = resolveHref(target);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const next = usesHashRouting() ? `#${href}` : href;

  if (next !== current) {
    if (options.replace) window.history.replaceState({ href }, "", next);
    else window.history.pushState({ href }, "", next);
  }
  window.dispatchEvent(new Event(NAV_EVENT));
}

export function subscribeToRoute(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener("hashchange", listener);
  window.addEventListener(NAV_EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("hashchange", listener);
    window.removeEventListener(NAV_EVENT, listener);
  };
}
