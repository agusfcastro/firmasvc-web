import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Check,
  FileText,
  Folder,
  Home,
  MessageSquare,
  PenLine,
  Phone,
  ShieldCheck,
  Star,
  TriangleAlert,
  Trophy,
  Users,
} from 'lucide-react';

// Maquetas de las pantallas del portal para el home. Son réplicas en código con datos
// inventados: ningún nombre, monto ni documento sale de un cliente real (regla 3).
// Copian el lenguaje del portal de hoy (barra de íconos tinta, contenido marfil, títulos
// con una palabra resaltada, tarjetas de cifras) sin importar sus componentes, así un
// cambio en el portal no rompe el home ni al revés.

const barra = [
  { icono: Home, nombre: 'Inicio' },
  { icono: Users, nombre: 'Clientes' },
  { icono: Trophy, nombre: 'Equipo' },
  { icono: PenLine, nombre: 'Firmas' },
  { icono: Folder, nombre: 'Asuntos' },
  { icono: Phone, nombre: 'Llamadas' },
  { icono: Bell, nombre: 'Avisos' },
];

/** Ventana del portal: barra del navegador, barra de íconos tinta y el contenido. */
export const Ventana: React.FC<{
  activo: string;
  ruta: string;
  interactiva?: boolean;
  children: React.ReactNode;
}> = ({ activo, ruta, interactiva = false, children }) => (
  <div
    className="maqueta"
    {...(interactiva
      ? { role: 'group', 'aria-label': 'Ejemplo del portal con datos inventados' }
      : { 'aria-hidden': true })}
  >
    <div className="maqueta-barra">
      <span className="maqueta-punto" />
      <span className="maqueta-punto" />
      <span className="maqueta-punto" />
      <span className="maqueta-url">firmasvc.com/portal/{ruta}</span>
    </div>
    <div className="maqueta-cuerpo">
      <nav className="maqueta-lateral" aria-hidden="true">
        <span className="maqueta-marca">firma</span>
        {barra.map((l) => (
          <span key={l.nombre} className={`maqueta-item ${l.nombre === activo ? 'activo' : ''}`}>
            <l.icono size={15} strokeWidth={1.8} />
            {l.nombre}
          </span>
        ))}
      </nav>
      <div className="maqueta-hoja">{children}</div>
    </div>
  </div>
);

const Pastilla: React.FC<{ tono?: 'ok' | 'aviso' | 'peligro' | 'neutro' | 'tinta'; children: React.ReactNode }> = ({
  tono = 'neutro',
  children,
}) => <span className={`m-pastilla m-${tono}`}>{children}</span>;

/** Encabezado como el del portal: volanta y título con una parte resaltada. */
const Encabezado: React.FC<{ volanta: string; antes: string; resalte: string; derecha?: React.ReactNode }> = ({
  volanta,
  antes,
  resalte,
  derecha,
}) => (
  <div className="flex items-end justify-between gap-3">
    <div className="flex flex-col gap-1.5 min-w-0">
      <span className="m-eyebrow">{volanta}</span>
      <span className="m-titulo">
        {antes} <span className="m-resalte">{resalte}</span>
      </span>
    </div>
    {derecha}
  </div>
);

const Cifras: React.FC<{ items: [string, string, ('peligro' | undefined)?][] }> = ({ items }) => (
  <div className="m-cifras">
    {items.map(([n, t, tono]) => (
      <div key={t} className="m-cifra-celda">
        <span className={`m-cifra-num ${tono === 'peligro' ? 'text-peligro' : ''}`}>{n}</span>
        <span className="text-[10.5px] text-piedra leading-tight">{t}</span>
      </div>
    ))}
  </div>
);

/* ---------------------------------------------------------------- Clientes: línea de tiempo */

// Ventana de la línea de tiempo: de septiembre de 2026 a mayo de 2027, con «hoy» a fin de noviembre.
const DESDE = Date.UTC(2026, 8, 1);
const HASTA = Date.UTC(2027, 5, 1);
const HOY = Date.UTC(2026, 10, 28);
const MESES = ['Sept', 'Oct', 'Nov', 'Dic', 'Ene 27', 'Feb', 'Mar', 'Abr', 'May'];
const pos = (f: string) => {
  const [a, m, d] = f.split('-').map(Number);
  return Math.min(100, Math.max(0, ((Date.UTC(a, m - 1, d) - DESDE) / (HASTA - DESDE)) * 100));
};
const posHoy = ((HOY - DESDE) / (HASTA - DESDE)) * 100;

type TipoMarca = 'reunion' | 'agendada' | 'pagada' | 'vencida' | 'logro' | 'alerta';
interface Marca {
  tipo: TipoMarca;
  fecha: string;
  titulo: string;
  sub: string;
}
interface Caso {
  desde: string;
  hasta?: string;
  titulo: string;
  sub: string;
}
interface ClienteLinea {
  id: string;
  nombre: string;
  detalle: string;
  inicio: string;
  fin: string;
  meses: number;
  termina: string;
  pendiente?: boolean;
  etiqueta?: { texto: string; tono: 'peligro' | 'neutro' };
  resumen: React.ReactNode[];
  marcas: Marca[];
  casos: Caso[];
}

const clientes: ClienteLinea[] = [
  {
    id: 'lucia',
    nombre: 'Lucía Méndez',
    detalle: 'MENTORÍA · Sofía Ruiz',
    inicio: '2026-08-03',
    fin: '2027-08-03',
    meses: 12,
    termina: 'termina 3 ago',
    resumen: [
      <>Cobrado <strong>USD 4.000</strong> de USD 12.000</>,
      <>Próxima reunión <strong>2 dic</strong></>,
      <span className="text-exito font-semibold">1 logro este trimestre</span>,
    ],
    marcas: [
      { tipo: 'reunion', fecha: '2026-09-02', titulo: 'Seguimiento, hecha', sub: 'día 30 · 2 sept' },
      { tipo: 'pagada', fecha: '2026-09-05', titulo: 'Cuota 2 pagada', sub: 'USD 1.000 · 5 sept' },
      { tipo: 'reunion', fecha: '2026-10-02', titulo: 'Seguimiento, hecha', sub: 'día 60 · 2 oct' },
      { tipo: 'pagada', fecha: '2026-10-05', titulo: 'Cuota 3 pagada', sub: 'USD 1.000 · 5 oct' },
      { tipo: 'logro', fecha: '2026-10-21', titulo: 'Logro: primer lanzamiento', sub: 'USD 18.000 en ventas · 21 oct' },
      { tipo: 'reunion', fecha: '2026-11-02', titulo: 'Seguimiento, hecha', sub: 'día 91 · 2 nov' },
      { tipo: 'pagada', fecha: '2026-11-05', titulo: 'Cuota 4 pagada', sub: 'USD 1.000 · 5 nov' },
      { tipo: 'agendada', fecha: '2026-12-02', titulo: 'Seguimiento, agendada', sub: 'día 121 · 2 dic' },
    ],
    casos: [],
  },
  {
    id: 'diego',
    nombre: 'Diego Ferrari',
    detalle: 'HIGH TICKET · Tomás Ibarra',
    inicio: '2026-09-15',
    fin: '2027-03-15',
    meses: 6,
    termina: 'termina 15 mar',
    etiqueta: { texto: '1 cuota vencida', tono: 'peligro' },
    resumen: [
      <>Cobrado <strong>USD 1.500</strong> de USD 9.000</>,
      <span className="text-peligro font-semibold">1 cuota vencida</span>,
      <span className="text-aviso font-semibold">1 queja en curso</span>,
    ],
    marcas: [
      { tipo: 'reunion', fecha: '2026-09-16', titulo: 'Onboarding, hecha', sub: 'día 1 · 16 sept' },
      { tipo: 'pagada', fecha: '2026-10-15', titulo: 'Cuota 1 pagada', sub: 'USD 1.500 · 15 oct' },
      { tipo: 'reunion', fecha: '2026-10-20', titulo: 'Seguimiento, hecha', sub: 'día 35 · 20 oct' },
      { tipo: 'vencida', fecha: '2026-11-15', titulo: 'Cuota 2 vencida', sub: 'USD 1.500 · hace 13 días' },
      { tipo: 'alerta', fecha: '2026-11-19', titulo: 'Alerta: pide reembolso', sub: 'Por WhatsApp, sin reclamo formal · 19 nov' },
      { tipo: 'agendada', fecha: '2026-12-03', titulo: 'Llamada con FIRMA, agendada', sub: 'Para cerrar la queja · 3 dic' },
    ],
    casos: [{ desde: '2026-11-20', titulo: 'Queja abierta: reembolso', sub: 'Desde el 20 nov · la lleva FIRMA' }],
  },
  {
    id: 'martin',
    nombre: 'Martín Ríos',
    detalle: 'AGENCIA · Sofía Ruiz',
    inicio: '2026-10-01',
    fin: '2027-10-01',
    meses: 12,
    termina: 'termina 1 oct',
    resumen: [
      <>Cobrado <strong>USD 6.000</strong> de USD 6.000</>,
      <>Próxima reunión <strong>4 dic</strong></>,
      <span className="text-piedra">1 queja resuelta</span>,
    ],
    marcas: [
      { tipo: 'pagada', fecha: '2026-10-01', titulo: 'Pago completo', sub: 'USD 6.000 · 1 oct' },
      { tipo: 'reunion', fecha: '2026-10-02', titulo: 'Onboarding, hecha', sub: 'día 1 · 2 oct' },
      { tipo: 'reunion', fecha: '2026-11-03', titulo: 'Seguimiento, hecha', sub: 'día 33 · 3 nov' },
      { tipo: 'logro', fecha: '2026-11-16', titulo: 'Logro: testimonio en video', sub: '16 nov' },
      { tipo: 'agendada', fecha: '2026-12-04', titulo: 'Seguimiento, agendada', sub: 'día 64 · 4 dic' },
    ],
    casos: [{ desde: '2026-10-19', hasta: '2026-10-28', titulo: 'Queja resuelta: demora en la entrega', sub: '19 oct al 28 oct' }],
  },
  {
    id: 'paula',
    nombre: 'Paula Gómez',
    detalle: 'MENTORÍA · Julián Paz',
    inicio: '2026-11-25',
    fin: '2027-11-25',
    meses: 12,
    termina: 'termina 25 nov',
    pendiente: true,
    etiqueta: { texto: 'Firma pendiente', tono: 'neutro' },
    resumen: [<>Contrato enviado el <strong>25 nov</strong></>, <>Onboarding <strong>1 dic</strong></>],
    marcas: [{ tipo: 'agendada', fecha: '2026-12-01', titulo: 'Onboarding, agendada', sub: 'Se habilita con la firma · 1 dic' }],
    casos: [],
  },
];

const MarcaForma: React.FC<{ tipo: TipoMarca }> = ({ tipo }) => {
  if (tipo === 'logro') return <Star size={13} strokeWidth={1.5} className="text-aviso" fill="currentColor" />;
  if (tipo === 'alerta')
    return <TriangleAlert size={13} strokeWidth={2} className="text-peligro" fill="var(--color-peligro-suave)" />;
  return <span className={`mq-forma mq-${tipo}`} />;
};

const lado = (x: number) => (x > 78 ? 'derecha' : x < 14 ? 'izquierda' : 'centro');

export const MaquetaCrm: React.FC = () => {
  const [abierto, setAbierto] = useState('diego');
  const [punto, setPunto] = useState('diego-alerta-2026-11-19');
  const desliza = useRef<HTMLDivElement>(null);

  // En el celular la tabla se desliza de costado: arranca con «hoy» a la vista, como en el portal.
  useEffect(() => {
    const el = desliza.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const col = 112; // ancho de la columna de nombres en el celular (--mq-col)
    const xHoy = col + ((el.scrollWidth - col) * posHoy) / 100;
    el.scrollLeft = Math.max(0, xHoy - col - (el.clientWidth - col) / 2);
  }, []);

  const senalar = (cliente: string, clave: string) => (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setAbierto(cliente);
    setPunto(clave);
  };

  return (
    <Ventana activo="Clientes" ruta="crm" interactiva>
      <Encabezado volanta="CRM legal" antes="Clientes de" resalte="Tu Empresa" />
      <Cifras
        items={[
          ['28', 'Contratos firmados'],
          ['USD 91.500', 'Monto acordado'],
          ['USD 76.750', 'Cobrado'],
          ['4', 'Con cuotas vencidas', 'peligro'],
        ]}
      />
      <div className="flex items-center justify-between gap-2 text-[11px] text-piedra">
        <span className="font-semibold text-tinta">Sept 2026 a may 2027</span>
        <span className="hidden min-[560px]:inline">Tocá un cliente y sus puntos para ver el detalle</span>
      </div>

      <div ref={desliza} className="mq-desliza">
        <div className="mq-tabla">
          {/* Meses */}
          <div className="mq-fila-meses">
            <span className="mq-col-nombre text-[10.5px] font-semibold text-piedra">Cliente</span>
            <div className="relative grid" style={{ gridTemplateColumns: `repeat(${MESES.length}, 1fr)` }}>
              {MESES.map((m) => (
                <span key={m} className="mq-mes">
                  {m}
                </span>
              ))}
              <span className="mq-hoy-rotulo" style={{ left: `${posHoy}%` }}>
                hoy
              </span>
            </div>
          </div>

          <div className="relative">
            <span className="mq-hoy-linea" style={{ left: `calc(var(--mq-col) + (100% - var(--mq-col)) * ${posHoy / 100})` }} aria-hidden="true" />
            {clientes.map((c) => {
              const expandido = abierto === c.id;
              const izq = pos(c.inicio);
              const der = pos(c.fin);
              const onboarding = Math.min(der, pos(addDias(c.inicio, 14))) - izq;
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandido}
                  onClick={() => setAbierto(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setAbierto(c.id);
                    }
                  }}
                  className={`mq-fila ${expandido ? 'abierta' : ''}`}
                >
                  <div className="mq-col-nombre flex flex-col min-w-0">
                    <span className="font-bold text-[12.5px] leading-tight truncate">{c.nombre}</span>
                    <span className="text-[10px] text-piedra truncate">{c.detalle}</span>
                    {expandido && (
                      <span className="mt-1.5 flex flex-col gap-0.5 text-[10.5px] leading-snug">
                        {c.resumen.map((r, i) => (
                          <span key={i}>{r}</span>
                        ))}
                        <span className="mt-0.5 font-semibold underline underline-offset-2">Abrir ficha →</span>
                      </span>
                    )}
                  </div>

                  <div className={`relative ${expandido ? 'h-[92px]' : 'h-[50px]'}`}>
                    {/* Contrato: onboarding en verde, vigente en tinta, firma pendiente punteada */}
                    <span
                      className={`mq-contrato ${c.pendiente ? 'pendiente' : ''} ${der >= 100 ? 'abierto-der' : ''}`}
                      style={{ left: `${izq}%`, width: `${der - izq}%` }}
                    >
                      {!c.pendiente && onboarding > 0 && <span className="mq-onboarding" style={{ width: `${(onboarding / (der - izq)) * 100}%` }} />}
                      <span className="mq-contrato-texto">
                        <span>{c.meses} meses</span>
                        <span className="opacity-80 hidden min-[640px]:inline">{c.termina}</span>
                      </span>
                    </span>
                    {c.etiqueta && !expandido && (
                      <span
                        className={`mq-etiqueta ${c.etiqueta.tono === 'peligro' ? 'm-peligro' : 'm-neutro'}`}
                        style={{ left: `calc(${Math.min(der, 74)}% + 6px)` }}
                      >
                        {c.etiqueta.texto}
                      </span>
                    )}

                    {/* Quejas y casos: barra fina, abierta en ámbar y cerrada en gris */}
                    {c.casos.map((k) => {
                      const clave = `${c.id}-caso-${k.desde}`;
                      const x1 = pos(k.desde);
                      const x2 = k.hasta ? pos(k.hasta) : posHoy;
                      return (
                        <button
                          key={clave}
                          type="button"
                          aria-label={`${k.titulo}. ${k.sub}`}
                          className={`mq-caso ${k.hasta ? 'cerrado' : ''}`}
                          style={{ left: `${x1}%`, width: `${Math.max(1.5, x2 - x1)}%`, top: expandido ? 58 : 40 }}
                          onMouseEnter={senalar(c.id, clave)}
                          onFocus={senalar(c.id, clave)}
                          onClick={senalar(c.id, clave)}
                        />
                      );
                    })}

                    {c.marcas.map((m) => {
                      const clave = `${c.id}-${m.tipo}-${m.fecha}`;
                      return (
                        <button
                          key={clave}
                          type="button"
                          aria-label={`${m.titulo}. ${m.sub}`}
                          className="mq-marca"
                          style={{ left: `${pos(m.fecha)}%`, top: expandido ? 40 : 30 }}
                          onMouseEnter={senalar(c.id, clave)}
                          onFocus={senalar(c.id, clave)}
                          onClick={senalar(c.id, clave)}
                        >
                          <MarcaForma tipo={m.tipo} />
                        </button>
                      );
                    })}

                    {/* Cartel del punto señalado, solo con el cliente abierto */}
                    {expandido &&
                      [...c.marcas.map((m) => ({ clave: `${c.id}-${m.tipo}-${m.fecha}`, x: pos(m.fecha), y: 40, titulo: m.titulo, sub: m.sub })),
                       ...c.casos.map((k) => ({ clave: `${c.id}-caso-${k.desde}`, x: pos(k.desde), y: 58, titulo: k.titulo, sub: k.sub }))]
                        .filter((p) => p.clave === punto)
                        .map((p) => (
                          <span key={p.clave} className={`mq-cartel ${lado(p.x)}`} style={{ left: `${p.x}%`, top: p.y + 11 }}>
                            <span className="block text-[11.5px] font-semibold">{p.titulo}</span>
                            <span className="block text-[10.5px] text-lateral-tenue">{p.sub}</span>
                          </span>
                        ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mq-leyenda" aria-hidden="true">
        <span><span className="mq-forma mq-reunion" /> Reunión</span>
        <span><span className="mq-forma mq-pagada" /> Cuota pagada</span>
        <span><span className="mq-forma mq-vencida" /> Cuota vencida</span>
        <span><Star size={11} className="text-aviso" fill="currentColor" /> Logro</span>
        <span><span className="mq-caso-muestra" /> Queja</span>
        <span><TriangleAlert size={11} className="text-peligro" /> Alerta de conducta</span>
      </div>
    </Ventana>
  );
};

function addDias(f: string, n: number) {
  const [a, m, d] = f.split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d + n));
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
}

/* ---------------------------------------------------------------- Firma electrónica */

export const MaquetaFirma: React.FC = () => (
  <Ventana activo="Firmas" ruta="firmas">
    <Encabezado volanta="Firmas" antes="Mandá a firmar" resalte="en un minuto." derecha={<span className="m-boton hidden min-[560px]:inline-flex">+ Nuevo envío</span>} />
    <Cifras items={[['2', 'En curso'], ['31', 'Firmados'], ['1', 'Vencen en 3 días', 'peligro']]} />
    <div className="m-tarjeta p-0 gap-0 overflow-hidden">
      <div className="m-tabla-cabeza">
        <span>Documento</span>
        <span className="text-center">Firmas</span>
        <span>Estado</span>
      </div>
      {[
        ['Contrato de servicios de Lucía Méndez', 'Lucía Méndez, Martín Ríos', '2/2', 'Firmado', 'ok'],
        ['Contrato de closer de Julián Paz', 'Julián Paz', '0/1', 'En curso', 'neutro'],
        ['Acuerdo de confidencialidad', 'Paula Gómez', '1/2', 'En curso', 'neutro'],
      ].map(([d, f, n, e, t], i) => (
        <div key={d} className={`m-tabla-fila ${i === 0 ? 'bg-niebla/60' : ''}`}>
          <span className="flex flex-col min-w-0">
            <span className="font-medium truncate">{d}</span>
            <span className="text-[10.5px] text-piedra truncate">{f}</span>
          </span>
          <span className="m-numero text-center">{n}</span>
          <span>
            <Pastilla tono={t as 'ok' | 'neutro'}>{e}</Pastilla>
          </span>
        </div>
      ))}
      <div className="m-auditoria">
        <span className="m-subtitulo">Registro de auditoría · Contrato de servicios de Lucía Méndez</span>
        <ol className="m-linea-tiempo">
          {[
            ['10:02', 'Enviado a Lucía Méndez y Martín Ríos'],
            ['10:14', 'Abierto por Lucía Méndez · IP 181.x.x.x'],
            ['10:15', 'Firmado por Lucía Méndez'],
            ['11:40', 'Firmado por Martín Ríos · sellado SHA-256'],
          ].map(([h, t]) => (
            <li key={t}>
              <span className="m-numero text-piedra">{h}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <span className="flex items-center gap-1.5 text-[11px]">
          <ShieldCheck size={13} className="shrink-0" />
          Verificable en <span className="m-numero font-medium">firmasvc.com/verificar/7KQ-28F</span>
        </span>
      </div>
    </div>
  </Ventana>
);

/* ---------------------------------------------------------------- Asuntos y documentos */

export const MaquetaAsuntos: React.FC = () => (
  <Ventana activo="Asuntos" ruta="asuntos/registro-de-marca">
    <Encabezado
      volanta="Asuntos"
      antes="Registro de"
      resalte="marca"
      derecha={
        <span className="m-abogado">
          <span className="m-avatar">AC</span>
          <span className="flex flex-col leading-tight">
            <span className="text-[10px] text-piedra">Tu abogado</span>
            <span className="text-[12px] font-semibold">Agustín Castro</span>
          </span>
        </span>
      }
    />
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
        <span className="m-renglon w-[72%]" />
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
  <Ventana activo="Llamadas" ruta="crm/llamadas">
    <Encabezado volanta="Llamada de venta · 42 min" antes="Prospecto:" resalte="Diego Ferrari" derecha={<Pastilla tono="ok">Revisado por FIRMA</Pastilla>} />
    <div className="grid grid-cols-1 min-[560px]:grid-cols-[2fr_3fr] gap-3">
      <div className="m-tarjeta items-start">
        <span className="m-subtitulo">Perfil de riesgo</span>
        <span className="m-cifra">
          72<span className="text-piedra text-[14px] font-medium">/100</span>
        </span>
        <div className="m-medidor">
          <span style={{ width: '72%', background: 'var(--color-peligro)' }} />
        </div>
        <Pastilla tono="peligro">Riesgo alto</Pastilla>
      </div>
      <div className="m-tarjeta">
        <span className="m-subtitulo">Lo que marcó el análisis</span>
        {[
          ['Preguntó tres veces por la garantía de resultado', 'peligro'],
          ['No pudo decir quién decide la compra', 'aviso'],
          ['Pidió pagar en 6 cuotas sin anticipo', 'aviso'],
          ['Entendió qué incluye el servicio', 'ok'],
        ].map(([t, tono]) => (
          <div key={t} className="flex items-center gap-2 text-[12px]">
            <span className={`m-punto m-${tono}`} />
            {t}
          </div>
        ))}
      </div>
    </div>
    <div className="m-tarjeta" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <TriangleAlert size={15} className="text-peligro shrink-0" />
      <span className="text-[12px]">
        Recomendación: cerrar con anticipo y la cláusula de resultados revisada por FIRMA.
      </span>
    </div>
  </Ventana>
);

/* ---------------------------------------------------------------- Equipo */

export const MaquetaEquipo: React.FC = () => (
  <Ventana activo="Equipo" ruta="equipo">
    <Encabezado volanta="Equipo" antes="Personas de" resalte="Tu Empresa" />
    <div className="grid grid-cols-1 min-[560px]:grid-cols-3 gap-3">
      {[
        ['Sofía Ruiz', 'Account Manager', ['Clientes exigentes', 'Onboarding'], '8 clientes', 'Todo al día', 'ok'],
        ['Tomás Ibarra', 'Account Manager', ['Cobranzas', 'High ticket'], '11 clientes', '1 cliente a seguir', 'aviso'],
        ['Julián Paz', 'Closer', ['Mentorías', 'Cierre en frío'], '5 cierres este mes', '1 firma pendiente', 'neutro'],
      ].map(([n, rol, perfil, carga, estado, tono]) => (
        <div key={n as string} className="m-tarjeta">
          <div className="flex items-center gap-2 min-w-0">
            <span className="m-avatar">{(n as string).split(' ').map((p) => p[0]).join('')}</span>
            <span className="flex flex-col min-w-0">
              <span className="font-semibold text-[12.5px] truncate">{n}</span>
              <span className="text-[10.5px] text-piedra">{rol}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {(perfil as string[]).map((p) => (
              <Pastilla key={p}>{p}</Pastilla>
            ))}
          </div>
          <span className="text-[11.5px] text-piedra">{carga}</span>
          <Pastilla tono={tono as 'ok' | 'aviso' | 'neutro'}>{estado}</Pastilla>
        </div>
      ))}
    </div>
    <div className="m-tarjeta" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <TriangleAlert size={15} className="text-aviso shrink-0" />
      <span className="text-[12px]">
        <strong className="font-semibold">Diego Ferrari</strong> lleva 6 días sin contacto. Lo tiene Tomás.
      </span>
    </div>
  </Ventana>
);

/* ---------------------------------------------------------------- Avisos */

export const MaquetaAvisos: React.FC = () => (
  <Ventana activo="Avisos" ruta="inicio">
    <Encabezado
      volanta="Sábado 28 de noviembre"
      antes="Buen día,"
      resalte="Martín"
      derecha={
        <span className="m-campana">
          <Bell size={14} />
          <span>3</span>
        </span>
      }
    />
    <div className="grid grid-cols-1 min-[560px]:grid-cols-[2fr_3fr] gap-3">
      <div className="flex flex-col gap-2">
        {[
          ['Firma completa', 'Contrato de servicios de Lucía Méndez', 'ahora'],
          ['Cuota vencida', 'Diego Ferrari · USD 1.500', 'hace 2 min'],
          ['Alerta de conducta', 'Diego Ferrari pide reembolso', 'hace 1 h'],
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
      <div className="m-tarjeta">
        <span className="m-subtitulo">Resumen de hoy · 7:00</span>
        {[
          ['Lucía Méndez firmó su contrato.', 'ok'],
          ['Vence la cuota 2 de Diego Ferrari.', 'peligro'],
          ['Hay 2 onboardings para el lunes.', 'neutro'],
          ['FIRMA respondió en Registro de marca.', 'ok'],
        ].map(([t, tono]) => (
          <div key={t} className="flex items-start gap-2 text-[12px]">
            <span className={`m-punto m-${tono} mt-1.5`} />
            {t}
          </div>
        ))}
      </div>
    </div>
  </Ventana>
);
