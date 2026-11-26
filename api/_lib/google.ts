/**
 * Google Calendar: OAuth y llamadas a la API, con fetch y sin dependencias.
 * Cada persona del equipo conecta su propio calendario (migración 0080). El
 * token de actualización se guarda cifrado en la base y el de acceso se pide
 * en cada uso, así no queda nada vigente fuera del servidor.
 * Variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y, opcional,
 * GOOGLE_REDIRECT_URI (por defecto la de producción).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ALCANCE_CALENDARIO = 'https://www.googleapis.com/auth/calendar.events.owned';
const ALCANCES = ['openid', 'https://www.googleapis.com/auth/userinfo.email', ALCANCE_CALENDARIO];
const VIGENCIA_ESTADO_MS = 15 * 60 * 1000;
export const COOKIE_ESTADO = 'firma_google';

export interface ConfigGoogle {
  clientId: string;
  secreto: string;
  redirect: string;
}

export function configGoogle(): ConfigGoogle | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const secreto = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !secreto) return null;
  return { clientId, secreto, redirect: process.env.GOOGLE_REDIRECT_URI || 'https://www.firmasvc.com/api/google/callback' };
}

export class ErrorGoogle extends Error {
  constructor(
    mensaje: string,
    readonly codigo: string,
  ) {
    super(mensaje);
  }
}

/* ------------------------------------------------------------------ */
/* Estado del OAuth: quién conecta, firmado y con vencimiento           */
/* ------------------------------------------------------------------ */
export interface Estado {
  /** usuario del portal */
  u: string;
  /** negocio */
  o: string;
  /** persona del equipo */
  m: string;
  /** nonce que también va en una cookie de este navegador */
  n: string;
  t: number;
}

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const firma = (cuerpo: string, secreto: string) => createHmac('sha256', secreto).update(cuerpo).digest('base64url');

export function nuevoNonce(): string {
  return randomBytes(18).toString('base64url');
}

export function firmarEstado(datos: Omit<Estado, 't'>, secreto: string): string {
  const cuerpo = b64(JSON.stringify({ ...datos, t: Date.now() }));
  return `${cuerpo}.${firma(cuerpo, secreto)}`;
}

export function leerEstado(estado: string | null, secreto: string): Estado | null {
  if (!estado) return null;
  const [cuerpo, sello] = estado.split('.');
  if (!cuerpo || !sello) return null;
  const esperado = Buffer.from(firma(cuerpo, secreto));
  const recibido = Buffer.from(sello);
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) return null;
  try {
    const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString()) as Estado;
    if (!datos.u || !datos.o || !datos.m || !datos.n || Date.now() - datos.t > VIGENCIA_ESTADO_MS) return null;
    return datos;
  } catch {
    return null;
  }
}

export function urlDeConsentimiento(cfg: ConfigGoogle, estado: string, email?: string | null): string {
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirect,
    response_type: 'code',
    scope: ALCANCES.join(' '),
    access_type: 'offline',
    // Siempre pide el permiso, así Google devuelve el token de actualización también al reconectar.
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    state: estado,
  });
  if (email) p.set('login_hint', email);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */
interface RespuestaToken {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function pedirToken(cuerpo: Record<string, string>): Promise<RespuestaToken> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(cuerpo),
  });
  const j = (await r.json().catch(() => ({}))) as RespuestaToken;
  if (!r.ok || !j.access_token) throw new ErrorGoogle(j.error_description || j.error || `Google respondió ${r.status}.`, j.error || 'token');
  return j;
}

export function canjearCodigo(cfg: ConfigGoogle, code: string): Promise<RespuestaToken> {
  return pedirToken({ code, client_id: cfg.clientId, client_secret: cfg.secreto, redirect_uri: cfg.redirect, grant_type: 'authorization_code' });
}

export async function tokenDeAcceso(cfg: ConfigGoogle, refresh: string): Promise<string> {
  const j = await pedirToken({ refresh_token: refresh, client_id: cfg.clientId, client_secret: cfg.secreto, grant_type: 'refresh_token' });
  return j.access_token as string;
}

export async function mailDe(acceso: string): Promise<string> {
  const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${acceso}` } });
  const j = (await r.json().catch(() => ({}))) as { email?: string };
  if (!r.ok || !j.email) throw new ErrorGoogle('Google no devolvió el mail de la cuenta.', 'mail');
  return j.email;
}

export async function revocar(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } }).catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Calendario                                                           */
/* ------------------------------------------------------------------ */
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export interface EventoCrudo {
  id: string;
  status?: string;
  summary?: string;
  visibility?: string;
  transparency?: string;
  hangoutLink?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
}

async function llamar<T>(acceso: string, url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { authorization: `Bearer ${acceso}`, 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const j = (await r.json().catch(() => ({}))) as T & { error?: { message?: string; status?: string } };
  if (!r.ok) throw new ErrorGoogle(j.error?.message || `Google Calendar respondió ${r.status}.`, j.error?.status || String(r.status));
  return j;
}

export async function eventosDe(acceso: string, desde: string, hasta: string): Promise<EventoCrudo[]> {
  const p = new URLSearchParams({ timeMin: desde, timeMax: hasta, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
  const j = await llamar<{ items?: EventoCrudo[] }>(acceso, `${API}?${p}`);
  return (j.items ?? []).filter((e) => e.status !== 'cancelled');
}

export interface EventoNuevo {
  titulo: string;
  descripcion: string;
  inicio: string;
  fin: string;
  invitados: string[];
  /** Para que Google no cree dos Meet si se reintenta. */
  pedido: string;
}

export async function crearEvento(acceso: string, e: EventoNuevo): Promise<EventoCrudo> {
  const p = new URLSearchParams({ conferenceDataVersion: '1', sendUpdates: e.invitados.length ? 'all' : 'none' });
  return llamar<EventoCrudo>(acceso, `${API}?${p}`, {
    method: 'POST',
    body: JSON.stringify({
      summary: e.titulo,
      description: e.descripcion,
      start: { dateTime: e.inicio },
      end: { dateTime: e.fin },
      attendees: e.invitados.map((email) => ({ email })),
      conferenceData: { createRequest: { requestId: e.pedido, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    }),
  });
}

export const enlaceDe = (e: EventoCrudo): string | null =>
  e.hangoutLink || e.conferenceData?.entryPoints?.find((x) => x.entryPointType === 'video')?.uri || null;
