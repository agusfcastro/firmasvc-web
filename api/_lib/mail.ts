/**
 * Mails de FIRMA con Resend. Un solo lugar para la plantilla con la marca y
 * para el envío. Lo usan la firma electrónica (api/firma), las invitaciones
 * al portal (api/admin/usuarios) y los avisos y resúmenes del portal. Los textos
 * que llegan en `parrafos`, `cita`, `datos`, `nota` y `pie` ya vienen escapados
 * por quien llama, porque pueden llevar <strong>, <em> o enlaces.
 * La carpeta empieza con guion bajo para que Vercel no la tome como función.
 *
 * La plantilla sigue el portal en negro y los posteos de @agustin.legales.
 * Cabecera tinta con el logo claro, la sección en pastilla y el título en
 * Archivo pesada con la frase clave resaltada. Cuerpo blanco con bordes
 * redondeados, botón tinta y la firma de Agustín en los mails del portal.
 * Todo en tablas y estilos en línea, así se ve igual en Gmail y en Outlook.
 */

import { COLOR, FUENTE } from './marca.js';

const MARFIL = COLOR.marfil;
const TINTA = COLOR.tinta;
const PIEDRA = COLOR.piedra;
const NIEBLA = COLOR.niebla;
const SEPARADOR = COLOR.separador;
const BLANCO = COLOR.blanco;
const TEXTO = FUENTE.texto;

function escaparMail(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Dirección pública de la web, para el logo, la foto y la fuente del mail. Con www, como el resto del portal. */
function baseWeb(): string {
  return (process.env.PORTAL_URL || 'https://www.firmasvc.com').replace(/\/$/, '');
}

export function mailDisponible(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export interface Plantilla {
  /** Sección de FIRMA que manda el mail, en la pastilla de arriba. Por ejemplo, Firma electrónica. */
  seccion: string;
  /** Título corto, con punto final. Va en texto plano y se escapa acá. */
  titulo: string;
  /** Parte del título que va resaltada en un bloque claro, como en los posteos. Tiene que estar tal cual en el título. */
  resalte?: string;
  parrafos: string[];
  /** Lo que escribió otra persona, en un recuadro. Ya viene escapado. */
  cita?: string;
  /** Datos en filas de rótulo y valor, como el vencimiento o el estado. El valor ya viene escapado. */
  datos?: { rotulo: string; valor: string }[];
  /** Código de un solo uso, en grande y fácil de copiar. */
  codigo?: string;
  /** Un párrafo después de la cita, los datos o el código. Ya viene escapado. */
  nota?: string;
  /** Listas con su rótulo. Cada ítem ya viene escapado, como los párrafos. */
  bloques?: { titulo: string; items: string[] }[];
  boton?: { texto: string; url: string };
  pie?: string;
  /** Texto que algunos clientes muestran junto al asunto en la bandeja. */
  anticipo?: string;
  /**
   * Firma de Agustín con su foto al final. Para los mails que FIRMA le manda a sus clientes.
   * No va en los de firma electrónica, que muchas veces los manda otra empresa, ni en los avisos a FIRMA.
   */
  firma?: boolean;
}

/** Título con la frase clave en un bloque marfil sobre la cabecera tinta. */
function tituloConResalte(titulo: string, resalte?: string): string {
  const t = escaparMail(titulo);
  if (!resalte) return t;
  const r = escaparMail(resalte);
  const i = t.lastIndexOf(r);
  if (i < 0) return t;
  return `${t.slice(0, i)}<span style="background:${MARFIL};color:${TINTA};padding:0 6px 2px;white-space:nowrap">${r}</span>${t.slice(i + r.length)}`;
}

const P = `margin:0 0 16px;font-family:${TEXTO};font-size:16px;line-height:1.6;color:${TINTA}`;
const ROTULO = `font-family:${TEXTO};font-size:11px;line-height:1.2;font-weight:600;letter-spacing:.16em;text-transform:uppercase;font-stretch:125%;color:${PIEDRA}`;

export function plantillaMail(o: Plantilla): string {
  const base = baseWeb();
  const parrafos = o.parrafos.map((p) => `<p style="${P}">${p}</p>`).join('');
  const cita = o.cita
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px"><tr><td bgcolor="${NIEBLA}" style="background:${NIEBLA};border-radius:16px;padding:18px 20px;font-family:${TEXTO};font-size:15px;line-height:1.6;color:${TINTA}">${o.cita}</td></tr></table>`
    : '';
  const filas = (o.datos ?? []).filter((d) => d.valor);
  const datos = filas.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;border-collapse:collapse">${filas
        .map(
          (d, i) =>
            `<tr><td valign="top" width="36%" style="padding:12px 12px 12px 0;border-top:1px solid ${SEPARADOR};${i === filas.length - 1 ? `border-bottom:1px solid ${SEPARADOR};` : ''}font-family:${TEXTO};font-size:13px;line-height:1.5;color:${PIEDRA}">${escaparMail(d.rotulo)}</td><td valign="top" style="padding:12px 0;border-top:1px solid ${SEPARADOR};${i === filas.length - 1 ? `border-bottom:1px solid ${SEPARADOR};` : ''}font-family:${TEXTO};font-size:15px;line-height:1.5;font-weight:600;color:${TINTA}">${d.valor}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const codigo = o.codigo
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px"><tr><td bgcolor="${NIEBLA}" style="background:${NIEBLA};border-radius:16px;padding:18px 22px 18px 28px;font-family:${TEXTO};font-size:38px;line-height:1;font-weight:800;letter-spacing:.22em;color:${TINTA}">${escaparMail(o.codigo)}</td></tr></table>`
    : '';
  const nota = o.nota ? `<p style="${P}">${o.nota}</p>` : '';
  const bloques = (o.bloques ?? [])
    .filter((b) => b.items.length)
    .map(
      (b) =>
        `<p style="margin:28px 0 4px;${ROTULO}">${escaparMail(b.titulo)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">${b.items
          .map((i) => `<tr><td style="padding:12px 0;border-top:1px solid ${SEPARADOR};font-family:${TEXTO};font-size:15px;line-height:1.55;color:${TINTA}">${i}</td></tr>`)
          .join('')}</table>`,
    )
    .join('');
  const boton = o.boton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0"><tr><td bgcolor="${TINTA}" style="background:${TINTA};border-radius:12px">
<a href="${escaparMail(o.boton.url)}" style="display:inline-block;padding:16px 24px;border-radius:12px;font-family:${TEXTO};font-size:15px;line-height:1;font-weight:600;color:${MARFIL};text-decoration:none">${escaparMail(o.boton.texto)}&nbsp;&rarr;</a>
</td></tr></table>
<p style="margin:14px 0 0;font-family:${TEXTO};font-size:12px;line-height:1.5;color:${PIEDRA}">Si el botón no funciona, copiá este enlace en el navegador.<br><a href="${escaparMail(o.boton.url)}" style="color:${TINTA};word-break:break-all">${escaparMail(o.boton.url)}</a></p>`
    : '';
  const pie = o.pie ? `<p style="margin:24px 0 0;font-family:${TEXTO};font-size:13px;line-height:1.55;color:${PIEDRA}">${o.pie}</p>` : '';
  const firma = o.firma
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0"><tr><td style="padding-top:24px;border-top:1px solid ${SEPARADOR}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="48" valign="middle"><img src="${base}/mail/agustin.jpg" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border:0;border-radius:24px"></td>
<td valign="middle" style="padding-left:14px"><p style="margin:0;font-family:${TEXTO};font-size:15px;line-height:1.3;font-weight:700;color:${TINTA}">Agustín Castro</p><p style="margin:2px 0 0;font-family:${TEXTO};font-size:13px;line-height:1.3;color:${PIEDRA}">Abogado (UBA) · FIRMA</p></td>
</tr></table>
</td></tr></table>`
    : '';
  const anticipo = o.anticipo
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escaparMail(o.anticipo)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>`
    : '';

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${escaparMail(o.titulo)}</title>
<style>
@font-face{font-family:'Archivo';font-style:normal;font-weight:100 900;font-stretch:62% 125%;font-display:swap;src:url(${base}/mail/archivo.woff2) format('woff2')}
@media (max-width:620px){.m-afuera{padding:16px 8px 28px!important}.m-caja{padding-left:24px!important;padding-right:24px!important}.m-titulo{font-size:28px!important}}
</style></head>
<body style="margin:0;padding:0;background:${MARFIL}">
${anticipo}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${MARFIL}" style="background:${MARFIL}"><tr><td class="m-afuera" align="center" style="padding:36px 16px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
<tr><td class="m-caja" bgcolor="${TINTA}" style="background:${TINTA};border-radius:24px 24px 0 0;padding:32px 40px 40px">
<img src="${base}/mail/firma-lockup-claro.png" width="188" height="43" alt="firma · Castro &amp; Partners Legal Consulting" style="display:block;border:0;width:188px;height:auto;font-family:${TEXTO};font-size:24px;font-weight:800;color:${MARFIL}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0"><tr><td bgcolor="${MARFIL}" style="background:${MARFIL};border-radius:999px;padding:7px 13px 6px;font-family:${TEXTO};font-size:11px;line-height:1;font-weight:600;letter-spacing:.16em;text-transform:uppercase;font-stretch:125%;color:${TINTA};white-space:nowrap">${escaparMail(o.seccion)}</td></tr></table>
<h1 class="m-titulo" style="margin:18px 0 0;font-family:${TEXTO};font-size:34px;line-height:1.14;font-weight:800;letter-spacing:-.02em;color:${MARFIL}">${tituloConResalte(o.titulo, o.resalte)}</h1>
</td></tr>
<tr><td class="m-caja" bgcolor="${BLANCO}" style="background:${BLANCO};border-radius:0 0 24px 24px;padding:36px 40px 40px">
${parrafos}${cita}${datos}${codigo}${nota}${bloques}${boton}${pie}${firma}
</td></tr>
<tr><td class="m-caja" style="padding:24px 40px 0">
<p style="margin:0;font-family:${TEXTO};font-size:12px;line-height:1.6;color:${PIEDRA}">FIRMA · Castro &amp; Partners Legal Consulting · <a href="${base}" style="color:${PIEDRA};text-decoration:underline">firmasvc.com</a><br>Información confidencial, alcanzada por el secreto profesional.</p>
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
        `Ya tenés acceso al portal de clientes de FIRMA${o.empresa ? ` para <strong>${escaparMail(o.empresa)}</strong>` : ''}. Ahí están tus contratos, las firmas, los protocolos de tu equipo y cada asunto con su próximo paso, siempre con la última revisión.`,
        'Para entrar, elegí tu contraseña. Se guarda cifrada y nadie en FIRMA puede verla.',
      ]
    : [hola, 'Te mandamos un enlace para elegir una contraseña nueva en el portal de clientes de FIRMA. Tocá el botón, elegila y entrás.'];
  return enviarMail({
    nombreRemitente: 'FIRMA',
    direccion: REMITENTE_PORTAL(),
    para: [o.email],
    asunto: invitacion ? 'Tu portal de FIRMA ya está listo' : 'Elegí tu contraseña nueva del portal de FIRMA',
    html: plantillaMail({
      seccion: 'Portal de clientes',
      titulo: invitacion ? 'Tu portal ya está listo.' : 'Elegí tu contraseña nueva.',
      resalte: invitacion ? 'listo.' : 'contraseña nueva.',
      anticipo: invitacion ? 'Elegí tu contraseña y entrá al portal de clientes.' : 'Tu enlace para elegir una contraseña nueva.',
      parrafos,
      boton: { texto: invitacion ? 'Elegir mi contraseña' : 'Elegir contraseña nueva', url: o.enlace },
      pie: invitacion
        ? 'El enlace es personal, vence en 24 horas y se usa una sola vez. Si no esperabas este mail, ignoralo.'
        : 'El enlace es personal, vence en 24 horas y se usa una sola vez. Si no lo esperabas, ignorá este mail y tu contraseña sigue igual.',
      firma: true,
    }),
    responderA: 'agustin@firmasvc.com',
  });
}
