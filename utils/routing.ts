// ─────────────────────────────────────────────────────────────────────
// SealedVow — Central Route Resolver
// Single source of truth for all URL-based routing decisions.
// Add new routes here — nowhere else.
// ─────────────────────────────────────────────────────────────────────

import { AppStage } from '../types';

export type RouteType =
  | 'EIDI_CREATE'
  | 'EIDI_RECEIVER'
  | 'EID_SELECTOR'
  | 'EID_PREPARATION'
  | 'DEMO_EID'
  | 'OCCASION_SELECTOR'
  | 'LETTER_CREATE'
  | 'ABOUT'
  | 'DEMO'
  | 'API'
  | 'RECEIVER'
  | 'HOME';

export function getRouteType(): RouteType {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  if (path === '/eidi/create')                   return 'EIDI_CREATE';
  if (/^\/eidi\/[A-Z0-9]{6}$/i.test(path))      return 'EIDI_RECEIVER';

  if (path === '/create')                        return 'OCCASION_SELECTOR';
  if (path === '/letter/create')                 return 'LETTER_CREATE';
  if (path === '/about')                         return 'ABOUT';
  if (path === '/eid')                           return 'EID_SELECTOR';
  if (/^\/demo\/eid\/[a-z-]+$/.test(path))       return 'DEMO_EID';
  if (/^\/eid\/[a-z-]+$/.test(path))             return 'EID_PREPARATION';
  if (path === '/demo/eid')                      return 'EID_SELECTOR';

  if (path.startsWith('/demo'))                  return 'DEMO';
  if (path.startsWith('/api'))                   return 'API';

  /* receiver links are short share codes like /AB12CD */
  if (/^\/[A-Za-z0-9_-]{5,}$/.test(path))        return 'RECEIVER';

  return 'HOME';
}

export function isEidiRoute(type: RouteType): boolean {
  return type === 'EIDI_CREATE' || type === 'EIDI_RECEIVER';
}

export function isReceiverLinkType(type: RouteType): boolean {
  return type === 'RECEIVER';
}

// Single source of truth for route → initial stage mapping.
// Used by App.tsx's useState initializer (hard refresh) and popstate
// handler (soft nav) to make /letter/create deterministically enter
// PREPARE without going through LANDING first.
export function initialStageForRoute(routeType: RouteType): AppStage {
  return routeType === 'LETTER_CREATE'
    ? AppStage.PREPARE
    : AppStage.LANDING;
}
