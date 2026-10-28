/**
 * Mails de FIRMA con Resend. Un solo lugar para la plantilla con la marca y
 * para el envío. Lo usan la firma electrónica (api/firma) y las invitaciones
 * al portal (api/admin/usuarios). Los textos que llegan en `parrafos` y `pie`
 * ya vienen escapados por quien llama, porque pueden llevar <strong> o <em>.
 * La carpeta empieza con guion bajo para que Vercel no la tome como función.
 */

const MARFIL = '#F5F3EC';
const TINTA = '#1B1F1B';
const PIEDRA = '#6B6553';
const BOSQUE = '#173A2F';
const LINEA = '#DEDBD0';
const CARBON = '#2B2B2B';
const CALIDO = '#A9A79E';

/** Fuentes de la marca. Apple Mail y algunos clientes las cargan; el resto usa Georgia y Arial. */
const TITULO = "'Bitter', Georgia, 'Times New Roman', serif";
const TEXTO = "'Archivo', Arial, Helvetica, sans-serif";

function escaparMail(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Dirección pública de la web, para el logo del mail. Con www, como el resto del portal. */
function baseWeb(): string {
  return (process.env.PORTAL_URL || 'https://www.firmasvc.com').replace(/\/$/, '');
}

export function mailDisponible(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export interface Plantilla {
  /** Sección de FIRMA que manda el mail, arriba del título. Por ejemplo, Firma electrónica. */
  seccion: string;
  titulo: string;
  parrafos: string[];
  /** Listas con su rótulo, debajo de los párrafos. Cada ítem ya viene escapado, como los párrafos. */
  bloques?: { titulo: string; items: string[] }[];
  boton?: { texto: string; url: string };
  pie?: string;
  /** Texto que algunos clientes muestran junto al asunto en la bandeja. */
  anticipo?: string;
}

export function plantillaMail(o: Plantilla): string {
  const parrafos = o.parrafos
    .map((p) => `<p style="margin:0 0 16px;font-family:${TEXTO};font-size:15px;line-height:1.65;color:${TINTA}">${p}</p>`)
    .join('');
  const bloques = (o.bloques ?? [])
    .filter((b) => b.items.length)
    .map(
      (b) =>
        `<p style="margin:28px 0 6px;font-family:${TEXTO};font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${PIEDRA}">${escaparMail(b.titulo)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${b.items
          .map((i) => `<tr><td style="padding:10px 0;border-top:1px solid ${LINEA};font-family:${TEXTO};font-size:14px;line-height:1.55;color:${TINTA}">${i}</td></tr>`)
          .join('')}</table>`,
    )
    .join('');
  const boton = o.boton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 12px"><tr><td style="background:${BOSQUE}">
<a href="${escaparMail(o.boton.url)}" style="display:inline-block;padding:15px 28px;font-family:${TEXTO};font-size:15px;font-weight:600;color:${MARFIL};text-decoration:none">${escaparMail(o.boton.texto)} &rarr;</a>
</td></tr></table>
<p style="margin:0 0 8px;font-family:${TEXTO};font-size:12px;line-height:1.5;color:${PIEDRA}">Si el botón no funciona, copiá este enlace en el navegador:<br><a href="${escaparMail(o.boton.url)}" style="color:${BOSQUE};word-break:break-all">${escaparMail(o.boton.url)}</a></p>`
    : '';
  const pie = o.pie
    ? `<p style="margin:24px 0 0;padding-top:18px;border-top:1px solid ${LINEA};font-family:${TEXTO};font-size:12px;line-height:1.55;color:${PIEDRA}">${o.pie}</p>`
    : '';
  const anticipo = o.anticipo
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escaparMail(o.anticipo)}</div>`
    : '';

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600&family=Bitter:wght@700;900&display=swap" rel="stylesheet">
<title>${escaparMail(o.titulo)}</title></head>
<body style="margin:0;padding:0;background:${MARFIL}">
${anticipo}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${MARFIL}"><tr><td align="center" style="padding:36px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px">
<tr><td style="padding:0 4px 24px">
<img src="${baseWeb()}/mail/firma-lockup.png" width="200" height="45" alt="firma · Castro &amp; Partners Legal Consulting" style="display:block;border:0;width:200px;height:auto;font-family:${TITULO};font-size:24px;font-weight:900;color:${TINTA}">
</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid ${LINEA};border-top:3px solid ${BOSQUE};padding:36px 32px">
<p style="margin:0 0 14px;font-family:${TEXTO};font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:${PIEDRA}">${escaparMail(o.seccion)}</p>
<h1 style="margin:0 0 22px;font-family:${TITULO};font-size:26px;font-weight:900;line-height:1.2;letter-spacing:-.01em;color:${TINTA}">${escaparMail(o.titulo)}</h1>
${parrafos}${bloques}${boton}${pie}
</td></tr>
<tr><td style="background:${CARBON};padding:22px 32px">
<p style="margin:0 0 4px;font-family:${TEXTO};font-size:13px;font-weight:600;color:${MARFIL}">Agustín Castro · Abogado (UBA)</p>
<p style="margin:0;font-family:${TEXTO};font-size:12px;line-height:1.6;color:${CALIDO}">FIRMA · Castro &amp; Partners Legal Consulting · <a href="${baseWeb()}" style="color:${CALIDO};text-decoration:underline">firmasvc.com</a><br>Información confidencial, alcanzada por el secreto profesional.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** Manda un mail con Resend. Devuelve null si salió o el motivo si no. */
export async function enviarMail(o: {
  nombreRemitente: string;
  para: string[];
  asunto: string;
  html: string;
  responderA?: string | null;
  adjuntos?: { filename: string; content: string }[];
  /** Dirección del remitente. Si falta, la de FIRMA_MAIL_DIRECCION o firmas@firmasvc.com. */
  direccion?: string;
  /** Encabezados extra, como List-Unsubscribe en los mails periódicos. */
  encabezados?: Record<string, string>;
}): Promise<string | null> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return 'Falta configurar RESEND_API_KEY.';
  const direccion = o.direccion || process.env.FIRMA_MAIL_DIRECCION || 'firmas@firmasvc.com';
  const nombre = o.nombreRemitente.replace(/[<>"\r\n]/g, '').slice(0, 80) || 'FIRMA';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${clave}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: `${nombre} <${direccion}>`,
        to: o.para,
        subject: o.asunto.replace(/[\r\n]/g, ' ').slice(0, 200),
        html: o.html,
        ...(o.responderA ? { reply_to: o.responderA } : {}),
        ...(o.adjuntos?.length ? { attachments: o.adjuntos } : {}),
        ...(o.encabezados ? { headers: o.encabezados } : {}),
      }),
    });
    if (!r.ok) {
      const cuerpo = await r.text().catch(() => '');
      return `Resend respondió ${r.status}. ${cuerpo.slice(0, 200)}`;
    }
    return null;
  } catch (e) {
    return `No hubo conexión con Resend. ${(e as Error).message}`;
  }
}

/* ------------------------------------------------------------------ */
/* Acceso al portal                                                     */
/* ------------------------------------------------------------------ */
/**
 * Enlace de acceso que pasa por firmasvc.com/portal/clave en lugar del de
 * Supabase. La página valida el token con verifyOtp recién cuando la persona
 * la abre, así un filtro de correo que revisa el enlace no lo gasta.
 * paginaClave es la dirección completa de /portal/clave.
 */
export function enlaceDeAcceso(paginaClave: string, hashedToken: string, tipo: 'invite' | 'recovery'): string {
  return `${paginaClave}?token_hash=${encodeURIComponent(hashedToken)}&type=${tipo}`;
}

const REMITENTE_PORTAL = () => process.env.PORTAL_MAIL_DIRECCION || 'portal@firmasvc.com';

/** Mail de acceso al portal por Resend. Devuelve null si salió o el motivo si no. */
export async function mailDeAcceso(o: { email: string; nombre: string | null; empresa: string | null; enlace: string; tipo: 'invite' | 'recovery' }): Promise<string | null> {
  const hola = o.nombre ? `Hola ${escaparMail(o.nombre.split(' ')[0])}.` : 'Hola.';
  const invitacion = o.tipo === 'invite';
  const parrafos = invitacion
    ? [
        hola,
        `Te dimos acceso al portal de clientes de FIRMA${o.empresa ? ` para <strong>${escaparMail(o.empresa)}</strong>` : ''}. Ahí están los contratos, las firmas, los protocolos y la formación de tu equipo, con la última revisión de FIRMA.`,
        'Para entrar, definí tu contraseña. Se guarda cifrada y nadie en FIRMA puede verla.',
      ]
    : [hola, 'Te mandamos un enlace para definir la contraseña de tu cuenta en el portal de clientes de FIRMA.'];
  return enviarMail({
    nombreRemitente: 'FIRMA',
    direccion: REMITENTE_PORTAL(),
    para: [o.email],
    asunto: invitacion ? 'Tu acceso al portal de clientes de FIRMA' : 'Definí tu contraseña del portal de FIRMA',
    html: plantillaMail({
      seccion: 'Portal de clientes',
      titulo: invitacion ? 'Tu acceso al portal de FIRMA' : 'Definí tu contraseña',
      anticipo: invitacion ? 'Definí tu contraseña para entrar al portal de clientes.' : 'Enlace para definir tu contraseña.',
      parrafos,
      boton: { texto: 'Definir mi contraseña', url: o.enlace },
      pie: 'El enlace es personal, vence en 24 horas y se usa una sola vez. Si no esperabas este mail, ignoralo.',
    }),
    responderA: 'agustin@firmasvc.com',
  });
}
