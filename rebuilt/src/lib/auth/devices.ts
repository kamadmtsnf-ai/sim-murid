/** Coarse display labels only: never store raw UA, IP, or treat this as authentication. */
export function deviceLabel(userAgent: string) {
  const ua = userAgent.slice(0, 1024);
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Macintosh|Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "perangkat tidak dikenal";
  return `${browser} · ${os}`;
}
