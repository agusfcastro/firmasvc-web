import React from 'react';
import { ArrowRight, BookOpen, CalendarDays, ClipboardList, FileText, GraduationCap, Kanban, PenLine, ShieldCheck, Users, Wallet } from 'lucide-react';
import { Encabezado, Enlace, Marco } from './ui';
import type { EstadoSesion } from './useSesion';
import { ROTULO_ROL, permisosDe, type Permisos } from './tipos';

interface Modulo {
  titulo: string;
  texto: string;
  icono: React.ElementType;
  ruta?: string;
  externo?: boolean;
  soloAdmin?: boolean;
  /** Permiso que hace falta para verlo */
  permiso?: keyof Permisos;
}

const MODULOS: Modulo[] = [
  { titulo: 'CRM legal', texto: 'Clientes, contratos, firmas y plan de pagos, al día y con historial.', icono: Kanban, ruta: '/portal/crm', permiso: 'crm' },
  { titulo: 'Documentos', texto: 'Modelos de contrato, contratos con tu equipo y otros documentos de tu empresa.', icono: FileText, ruta: '/portal/documentos', permiso: 'documentosLegales' },
  { titulo: 'Firma electrónica', texto: 'Mandá un PDF a firmar y seguí cada firma, con constancia y verificación.', icono: PenLine, ruta: '/portal/firmas', permiso: 'documentosLegales' },
  { titulo: 'Agenda', texto: 'Reservá una reunión con FIRMA en el horario que te quede mejor.', icono: CalendarDays, ruta: '/portal/agenda', permiso: 'agenda' },
  { titulo: 'Administración', texto: 'Empresas, usuarios, roles y registro de accesos.', icono: ShieldCheck, ruta: '/portal/admin', soloAdmin: true },
  { titulo: 'Protocolos', texto: 'Los protocolos de trabajo de cada área de tu equipo.', icono: BookOpen, ruta: '/protocolo-llamadas', externo: true },
  { titulo: 'Estado de asuntos', texto: 'Seguimiento de cada trámite en curso.', icono: ClipboardList, permiso: 'casos' },
  { titulo: 'Abonos y pagos', texto: 'Tu abono mensual con FIRMA, el próximo cobro y el historial de pagos.', icono: Wallet, ruta: '/portal/pagos', permiso: 'gestion' },
  { titulo: 'Formación', texto: 'Videos por área para capacitar a tu equipo.', icono: GraduationCap },
  { titulo: 'Mi equipo', texto: 'Personas de tu empresa con acceso al portal.', icono: Users, permiso: 'gestion' },
];

function saludo(): string {
  const h = new Date().getHours();
  return h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

export const Inicio: React.FC<{ estado: EstadoSesion }> = ({ estado }) => {
  const { perfil, organizacion } = estado;
  if (!perfil) return null;
  const esAdmin = perfil.rol === 'admin';
  const permisos = permisosDe(perfil.rol);
  const visibles = MODULOS.filter((m) => (m.soloAdmin ? esAdmin : m.permiso ? permisos[m.permiso] : true));
  // Sin documentos legales, la biblioteca muestra solo protocolos: se entra por ahí.
  if (!permisos.documentosLegales) {
    const i = visibles.findIndex((m) => m.titulo === 'Protocolos');
    if (i >= 0) visibles[i] = { ...visibles[i], texto: 'Los protocolos de trabajo y la formación de tu equipo.', ruta: '/portal/documentos', externo: false };
  }
  const nombre = (perfil.nombre || '').split(' ')[0];

  return (
    <Marco perfil={perfil}>
      <Encabezado
        grande
        eyebrow={`${esAdmin ? 'FIRMA' : organizacion?.nombre ?? ''} · ${ROTULO_ROL[perfil.rol]}`}
        titulo={
          <>
            {saludo()}
            {nombre ? ',' : ''}
            <br />
            <span className="text-bosque">{nombre || 'bienvenido'}</span>
          </>
        }
        bajada={esAdmin ? 'Desde acá gestionás los CRM y los accesos de todos tus clientes.' : 'Todo lo legal de tu empresa, ordenado y en un solo lugar.'}
      />

      <section className="section bg-carbon text-marfil">
        <div className="wrap flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <p className="eyebrow text-calido">Tu portal</p>
            <h2 className="h2">Herramientas</h2>
          </div>
          <div className="grid grid-cols-1 tab:grid-cols-2 wide:grid-cols-3 gap-5">
            {visibles.map((m, i) => {
              const Icono = m.icono;
              const contenido = (
                <>
                  <span aria-hidden="true" className="wm">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="icon-box">
                    <Icono size={26} strokeWidth={1.8} />
                  </div>
                  <h3 className="h3 relative">{m.titulo}</h3>
                  <p className="relative text-[15px] leading-[1.6] text-calido">{m.texto}</p>
                  {m.ruta ? (
                    <span className="ir relative">
                      Entrar <ArrowRight size={16} />
                    </span>
                  ) : (
                    <span className="ir relative eyebrow text-[11px] text-calido">Próximamente</span>
                  )}
                </>
              );
              if (!m.ruta) {
                return (
                  <article key={m.titulo} className="card card-apagada" aria-disabled="true">
                    {contenido}
                  </article>
                );
              }
              return m.externo ? (
                <a key={m.titulo} href={m.ruta} target="_blank" rel="noopener" className="card">
                  {contenido}
                </a>
              ) : (
                <Enlace key={m.titulo} a={m.ruta} className="card">
                  {contenido}
                </Enlace>
              );
            })}
          </div>
        </div>
      </section>
    </Marco>
  );
};
