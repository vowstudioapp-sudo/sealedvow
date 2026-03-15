// ─────────────────────────────────────────────────────────────────────
// SealedVow — Central Route Resolver
// Single source of truth for all URL-based routing decisions.
// Add new routes here — nowhere else.
// ─────────────────────────────────────────────────────────────────────

export type RouteType =
  | 'EIDI_CREATE'
  | 'EIDI_RECEIVER'
  | 'EID_SELECTOR'
  | 'OCCASION_SELECTOR'
  | 'LETTER_CREATE'
  | 'DEMO'
  | 'API'
  | 'RECEIVER'
  | 'HOME';

export function getRouteType(): RouteType {
  const path = window.location.pathname;

  if (path === '/eidi/create')                   return 'EIDI_CREATE';
  if (/^\/eidi\/[A-Z0-9]{6}$/i.test(path))      return 'EIDI_RECEIVER';

  if (path === '/create')                        return 'OCCASION_SELECTOR';
  if (path === '/letter/create')                 return 'LETTER_CREATE';
  if (path === '/demo/eid')                      return 'EID_SELECTOR';

  if (path.startsWith('/demo'))                  return 'DEMO';
  if (path.startsWith('/api'))                   return 'API';
  if (path.length > 1)                           return 'RECEIVER';

  return 'HOME';
}

export function isEidiRoute(type: RouteType): boolean {
  return type === 'EIDI_CREATE' || type === 'EIDI_RECEIVER';
}

export function isReceiverLinkType(type: RouteType): boolean {
  return type === 'RECEIVER' || type === 'DEMO';
}