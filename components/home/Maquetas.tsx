import React from 'react';
import {
  Bell,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Folder,
  Home,
  Mail,
  MessageSquare,
  PenLine,
  Phone,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';

// Maquetas de las pantallas del portal para el home. Son réplicas en código con datos
// inventados: ningún nombre, monto ni documento sale de un cliente real (regla 3).
// Copian el lenguaje del portal (barra lateral tinta, hoja papel) sin importar sus
// componentes, así un cambio en el portal no rompe el home ni al revés.

const lateral = [
  { icono: Home, nombre: 'Inicio' },
  { icono: Users, nombre: 'Clientes' },
  { icono: PenLine, nombre: 'Firmas' },
  { icono: Folder, nombre: 'Asuntos' },
  { icono: Phone, nombre: 'Llamadas' },
  { icono: Trophy, nombre: 'Equipo' },
];

/** Ventana del portal: barra de navegador, lateral tinta y la hoja con el contenido. */
export const Ventana: React.FC<{ activo: string; ruta: string; children: React.ReactNode }> = ({
  activo,
  ruta,
  children,
}) => (
  <div className="maqueta" aria-hidden="true">
    <div className="maqueta-barra">
      <span className="maqueta-punto" />
      <span className="maqueta-punto" />
      <span className="maqueta-punto" />
      <span className="maqueta-url">firmasvc.com/portal/{ruta}</span>
    </div>
    <div className="maqueta-cuerpo">
      <nav className="maqueta-lateral">
        <span className="maqueta-marca">firma</span>
        {lateral.map((l) => (
          <span key={l.nombre} className={`maqueta-item ${l.nombre === activo ? 'activo' : ''}`}>
            <l.icono size={14} strokeWidth={1.8} />
            {l.nombre}
          </span>
        ))}
      </nav>
      <div className="maqueta-hoja">{children}</div>
    </div>
  </div>
);

const Pastilla: React.FC<{ tono?: 'ok' | 'aviso' | 'neutro'; children: React.ReactNode }> = ({
  tono = 'neutro',
  children,
}) => <span className={`m-pastilla m-${tono}`}>{children}</span>;

const Titulo: React.FC<{ arriba: string; children: React.ReactNode }> = ({ arriba, children }) => (
  <div className="flex flex-col gap-1">
    <span className="m-eyebrow">{arriba}</span>
    <span className="m-titulo">{children}</span>
  </div>
);

/* ---------------------------------------------------------------- CRM y contratos */

export const MaquetaCrm: React.FC = () => (
  <Ventana activo="Clientes" ruta="crm/lucia-mendez">
    <div className="flex items-start justify-between gap-3">
      <Titulo arriba="Cliente · Mentoría Escala">Lucía Méndez</Titulo>
      <Pastilla tono="ok">Activo</Pastilla>
    </div>
    <div className="grid grid-cols-1 min-[560px]:grid-cols-[3fr_2fr] gap-3">
      <div className="m-tarjeta">
        <span className="m-subtitulo">Plan de pagos · USD 3.000</span>
        {[
          ['Anticipo', 'USD 1.000', 'Pagado', 'ok'],
          ['Cuota 1', 'USD 1.000', 'Pagado', 'ok'],
          ['Cuota 2', 'USD 1.000', 'Vence 15/12', 'aviso'],
        ].map(([c, m, e, t]) => (
          <div key={c} className="m-fila">
            <span>{c}</span>
            <span className="m-numero">{m}</span>
            <Pastilla tono={t as 'ok' | 'aviso'}>{e}</Pastilla>
          </div>
        ))}
      </div>
      <div className="m-tarjeta">
        <span className="m-subtitulo">Contratos y firma</span>
        {[
          ['Contrato generado', true],
          ['Enviado a firmar', true],
          ['Firmado por las dos partes', false],
        ].map(([p, hecho]) => (
          <div key={p as string} className="flex items-center gap-2 text-[12px]">
            {hecho ? (
              <CheckCircle2 size={14} className="text-bosque shrink-0" />
            ) : (
              <Clock size={14} className="text-piedra shrink-0" />
            )}
            <span className={hecho ? '' : 'text-piedra'}>{p as string}</span>
          </div>
        ))}
        <span className="m-boton">Ver contrato</span>
      </div>
    </div>
  </Ventana>
);

/* ---------------------------------------------------------------- Firma electrónica */

export const MaquetaFirma: React.FC = () => (
  <Ventana activo="Firmas" ruta="firmas">
    <div className="flex items-start justify-between gap-3">
      <Titulo arriba="Envío a firma">Contrato de servicios.pdf</Titulo>
      <Pastilla tono="ok">Completo</Pastilla>
    </div>
    <div className="grid grid-cols-1 min-[560px]:grid-cols-2 gap-3">
      <div className="m-tarjeta">
        <span className="m-subtitulo">Firmantes</span>
        {[
          ['Martín Ríos', 'Proveedor'],
          ['Lucía Méndez', 'Cliente'],
        ].map(([n, r]) => (
          <div key={n} className="m-fila">
            <span className="flex flex-col">
              <span>{n}</span>
              <span className="text-piedra text-[11px]">{r}</span>
            </span>
            <Pastilla tono="ok">
              <Check size={11} /> Firmó
            </Pastilla>
          </div>
        ))}
      </div>
      <div className="m-tarjeta">
        <span className="m-subtitulo">Registro de auditoría</span>
        <ol className="m-linea-tiempo">
          {[
            ['10:02', 'Documento enviado'],
            ['10:14', 'Abierto · IP 181.x.x.x'],
            ['10:15', 'Firmado por Lucía Méndez'],
            ['10:15', 'Sello y huella SHA-256'],
          ].map(([h, t]) => (
            <li key={t}>
              <span className="m-numero text-piedra">{h}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
    <div className="m-tarjeta" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <ShieldCheck size={16} className="text-bosque shrink-0" />
      <span className="text-[12px]">
        Verificable en <span className="m-numero">firmasvc.com/verificar/7KQ-28F</span>
      </span>
    </div>
  </Ventana>
);

/* ---------------------------------------------------------------- Asuntos y documentos */

export const MaquetaAsuntos: React.FC = () => (
  <Ventana activo="Asuntos" ruta="asuntos/registro-de-marca">
    <div className="flex items-start justify-between gap-3">
      <Titulo arriba="Asunto">Registro de marca</Titulo>
      <span className="m-abogado">
        <span className="m-avatar">AC</span>
        <span className="flex flex-col leading-tight">
          <span className="text-[10px] text-piedra">Tu abogado</span>
          <span className="text-[12px] font-semibold">Agustín Castro</span>
        </span>
      </span>
    </div>
    <div className="m-pasos">
      {[
        ['Relevamiento', 'hecho'],
        ['Borrador', 'hecho'],
        ['Tu revisión', 'actual'],
        ['Presentación', ''],
      ].map(([p, e]) => (
        <span key={p} className={`m-paso ${e}`}>
          {e === 'hecho' ? <Check size={11} /> : null}
          {p}
        </span>
      ))}
    </div>
    <div className="grid grid-cols-1 min-[560px]:grid-cols-[3fr_2fr] gap-3">
      <div className="m-tarjeta m-documento">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-piedra" />
          <span className="text-[12px] font-medium">Solicitud de marca.docx</span>
          <Pastilla>v2</Pastilla>
        </div>
        <span className="m-renglon w-[92%]" />
        <span className="m-renglon w-[80%]" />
        <span className="m-renglon w-[86%] m-resaltado" />
        <span className="m-renglon w-[64%]" />
        <span className="m-renglon w-[88%]" />
      </div>
      <div className="m-tarjeta">
        <span className="m-subtitulo">Conversación</span>
        <div className="m-comentario">
          <MessageSquare size={12} className="shrink-0 mt-0.5" />
          <span>¿Sumamos también la clase 41?</span>
        </div>
        <div className="m-comentario m-respuesta">
          <span className="font-medium">Agustín</span> Sí, ya la agregué. Falta tu ok.
        </div>
      </div>
    </div>
  </Ventana>
);

/* ---------------------------------------------------------------- Análisis de llamadas */

export const MaquetaLlamadas: React.FC = () => (
  <Ventana activo="Llamadas" ruta="llamadas">
    <div className="flex items-start justify-between gap-3">
      <Titulo arriba="Llamada de venta · 42 min">Prospecto: Diego Ferrari</Titulo>
      <Pastilla tono="ok">Revisado por FIRMA</Pastilla>
    </div>
    <div className="grid grid-cols-1 min-[560px]:grid-cols-[2fr_3fr] gap-3">
      <div className="m-tarjeta items-start">
        <span className="m-subtitulo">Perfil de riesgo</span>
        <span className="m-cifra">
          38<span className="text-piedra text-[14px] font-medium">/100</span>
        </span>
        <div className="m-medidor">
          <span style={{ width: '38%' }} />
        </div>
        <Pastilla tono="ok">Riesgo bajo</Pastilla>
      </div>
      <div className="m-tarjeta">
        <span className="m-subtitulo">Lo que marcó el análisis</span>
        {[
          ['Entendió qué incluye el servicio', 'ok'],
          ['Preguntó por garantías de resultado', 'aviso'],
          ['Confirmó quién decide la compra', 'ok'],
          ['Pidió plan de pagos en cuotas', 'neutro'],
        ].map(([t, tono]) => (
          <div key={t} className="flex items-center gap-2 text-[12px]">
            <span className={`m-punto m-${tono}`} />
            {t}
          </div>
        ))}
      </div>
    </div>
  </Ventana>
);

/* ---------------------------------------------------------------- Equipo */

export const MaquetaEquipo: React.FC = () => (
  <Ventana activo="Equipo" ruta="equipo">
    <div className="flex items-start justify-between gap-3">
      <Titulo arriba="Equipo">Clientes por persona</Titulo>
      <Pastilla tono="aviso">1 a seguir</Pastilla>
    </div>
    <div className="grid grid-cols-1 min-[560px]:grid-cols-[3fr_2fr] gap-3">
      <div className="m-tarjeta">
        <span className="m-subtitulo">Perfil y asignación</span>
        {[
          ['Sofía', 'Onboarding · Clientes exigentes', 8],
          ['Tomás', 'Seguimiento · Cobranzas', 11],
          ['Julián', 'High ticket · Renovaciones', 5],
        ].map(([n, perfil, c]) => (
          <div key={n as string} className="m-fila">
            <span className="flex items-center gap-2 min-w-0">
              <span className="m-avatar">{(n as string)[0]}</span>
              <span className="flex flex-col min-w-0">
                <span className="font-medium">{n}</span>
                <span className="text-piedra text-[11px] truncate">{perfil}</span>
              </span>
            </span>
            <span className="m-numero text-piedra whitespace-nowrap">{c} clientes</span>
          </div>
        ))}
      </div>
      <div className="m-tarjeta">
        <span className="m-subtitulo">Seguimiento</span>
        {[
          ['Diego Ferrari', '6 días sin contacto', 'aviso'],
          ['Lucía Méndez', 'Al día', 'ok'],
          ['Martín Ríos', 'Al día', 'ok'],
        ].map(([c, e, t]) => (
          <div key={c} className="flex items-start gap-2 text-[12px]">
            <span className={`m-punto m-${t} mt-1.5`} />
            <span className="flex flex-col">
              <span>{c}</span>
              <span className="text-piedra text-[11px]">{e}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  </Ventana>
);

/* ---------------------------------------------------------------- Avisos */

export const MaquetaAvisos: React.FC = () => (
  <Ventana activo="Inicio" ruta="inicio">
    <div className="flex items-start justify-between gap-3">
      <Titulo arriba="Lunes 30 de noviembre">Buen día, Martín</Titulo>
      <span className="m-campana">
        <Bell size={14} />
        <span>3</span>
      </span>
    </div>
    <div className="grid grid-cols-1 min-[560px]:grid-cols-[3fr_2fr] gap-3">
      <div className="m-tarjeta">
        <span className="m-subtitulo flex items-center gap-1.5">
          <Mail size={12} /> Resumen diario · 7:00
        </span>
        {[
          'Lucía Méndez firmó su contrato.',
          'Vence la cuota 2 de Diego Ferrari el 15/12.',
          'Hay 2 onboardings para hoy.',
          'FIRMA respondió en Registro de marca.',
        ].map((t) => (
          <div key={t} className="flex items-start gap-2 text-[12px]">
            <span className="m-punto m-ok mt-1.5" />
            {t}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {[
          ['Firma completa', 'Contrato de servicios.pdf', 'ahora'],
          ['Cuota vencida', 'Diego Ferrari · USD 1.000', 'hace 2 min'],
          ['Asunto actualizado', 'Registro de marca', 'hace 1 h'],
        ].map(([t, d, h]) => (
          <div key={t} className="m-push">
            <span className="m-push-icono">f</span>
            <span className="flex flex-col min-w-0">
              <span className="font-medium">{t}</span>
              <span className="text-piedra truncate">{d}</span>
            </span>
            <span className="ml-auto text-[10.5px] text-piedra whitespace-nowrap self-start">{h}</span>
          </div>
        ))}
      </div>
    </div>
  </Ventana>
);
