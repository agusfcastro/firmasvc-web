import React from 'react';
import { ArrowRight, BookOpen, CalendarDays, ClipboardList, FileText, GraduationCap, Kanban, PenLine, ShieldCheck, Users, Wallet } from 'lucide-react';
import { Encabezado, Enlace, Marco } from './ui';
import type { EstadoSesion } from './useSesion';
import { cargoDe, permisosDe, type Permisos } from './tipos';

interface Modulo {
  titulo: string;
  texto: string;
  /** Lo que dice el enlace de la tarjeta: qué se hace al entrar. */
  accion?: string;
  icono: React.ElementType;
  ruta?: string;
  externo?: boolean;
  soloAdmin?: boolean;
  /** Permiso que hace falta para verlo */
  permiso?: keyof Permisos;
}

const MODULOS: Modulo[] = [
  { titulo: 'CRM legal', texto: 'Cada cliente con su contrato, el estado de la firma y el plan de cuotas pactado.', accion: 'Ver clientes', icono: Kanban, ruta: '/portal/crm', permiso: 'crm' },
  { titulo: 'Documentos', texto: 'Modelos redactados para tu negocio, contratos con tu equipo y documentación de la empresa.', accion: 'Ver documentos', icono: FileText, ruta: '/portal/documentos', permiso: 'documentosLegales' },
  { titulo: 'Firma electrónica', texto: 'Enviá un PDF a firmar, seguí quién firmó y recibí el documento sellado con su constancia.', accion: 'Enviar a firmar', icono: PenLine, ruta: '/portal/firmas', permiso: 'documentosLegales' },
  { titulo: 'Agenda', texto: 'Reuniones de consulta y seguimiento con Agustín Castro, en el horario que elijas.', accion: 'Agendar reunión', icono: CalendarDays, ruta: '/portal/agenda', permiso: 'agenda' },
  { titulo: 'Administración', texto: 'Empresas, usuarios, permisos y registro de accesos.', accion: 'Administrar', icono: ShieldCheck, ruta: '/portal/admin', soloAdmin: true },
  { titulo: 'Protocolos', texto: 'Cómo trabaja cada área de tu equipo, por escrito y con respaldo legal.', accion: 'Leer protocolos', icono: BookOpen, ruta: '/portal/protocolos' },
  { titulo: 'Estado de asuntos', texto: 'Trámites con FIRMA y conflictos de tu empresa, con su estado, el próximo paso y las novedades.', accion: 'Ver asuntos', icono: ClipboardList, ruta: '/portal/asuntos', permiso: 'casos' },
  { titulo: 'Abonos y pagos', texto: 'Condiciones de tu abono, próximo débito e historial de pagos.', accion: 'Ver pagos', icono: Wallet, ruta: '/portal/pagos', permiso: 'gestion' },
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
  // Lo que todavía no está listo solo lo ve FIRMA: al cliente, una tarjeta vacía le resta más de lo que anticipa.
  const visibles = MODULOS.filter((m) => (m.soloAdmin ? esAdmin : m.permiso ? permisos[m.permiso] : true) && (m.ruta || esAdmin));
  const nombre = (perfil.nombre || '').split(' ')[0];

  return (
    <Marco perfil={perfil}>
      <Encabezado
        grande
        eyebrow={`${esAdmin ? 'FIRMA' : organizacion?.nombre ?? ''} · ${cargoDe(perfil)}`}
        titulo={
          <>
            {saludo()}
            {nombre ? ', ' : ' '}
            {/* En un renglón cuando entra. En pantallas angostas el nombre baja entero, sin cortarse. */}
            <span className="text-bosque whitespace-nowrap">{nombre || 'bienvenido'}</span>
          </>
        }
        bajada={esAdmin ? undefined : `Contratos, firmas y protocolos de ${organizacion?.nombre ?? 'tu empresa'}.`}
      />

      <section className="section bg-carbon text-marfil">
        <div className="wrap flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <p className="eyebrow text-calido">{esAdmin ? 'FIRMA' : organizacion?.nombre ?? 'Tu cuenta'}</p>
            <h2 className="h2">{esAdmin ? 'Gestión' : 'Tu expediente'}</h2>
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
                      {m.accion ?? 'Abrir'} <ArrowRight size={16} />
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
