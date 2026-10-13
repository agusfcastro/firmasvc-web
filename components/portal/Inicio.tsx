import React from 'react';
import { BookOpen, FileText, GraduationCap, Kanban, ShieldCheck, Wallet, ClipboardList, Users } from 'lucide-react';
import { navegar } from './navegacion';
import { Etiqueta, Marco } from './ui';
import type { EstadoSesion } from './useSesion';
import { ROTULO_ROL } from './tipos';

interface Modulo {
  titulo: string;
  texto: string;
  icono: React.ElementType;
  ruta?: string;
  externo?: boolean;
  soloAdmin?: boolean;
  soloTitular?: boolean;
}

const MODULOS: Modulo[] = [
  { titulo: 'Panel de administración', texto: 'Clientes, usuarios, roles y registro de accesos.', icono: ShieldCheck, ruta: '/portal/admin', soloAdmin: true },
  { titulo: 'CRM legal', texto: 'Clientes, contratos, firmas y plan de pagos.', icono: Kanban, ruta: '/portal/crm' },
  { titulo: 'Documentos', texto: 'Contratos y documentación que preparamos para tu empresa.', icono: FileText },
  { titulo: 'Estado de asuntos', texto: 'Seguimiento de cada trámite en curso.', icono: ClipboardList },
  { titulo: 'Abonos y pagos', texto: 'Tu plan, vencimientos y facturación.', icono: Wallet, soloTitular: true },
  { titulo: 'Protocolos', texto: 'Protocolos de trabajo para cada área de tu equipo.', icono: BookOpen, ruta: '/protocolo-llamadas', externo: true },
  { titulo: 'Formación', texto: 'Videos por área para capacitar a tu equipo.', icono: GraduationCap },
  { titulo: 'Mi equipo', texto: 'Personas de tu empresa con acceso al portal.', icono: Users, soloTitular: true },
];

export const Inicio: React.FC<{ estado: EstadoSesion }> = ({ estado }) => {
  const { perfil, organizacion } = estado;
  if (!perfil) return null;
  const esAdmin = perfil.rol === 'admin';
  const visibles = MODULOS.filter((m) => (m.soloAdmin ? esAdmin : m.soloTitular ? esAdmin || perfil.rol === 'titular' : true));
  const nombre = (perfil.nombre || '').split(' ')[0];

  return (
    <Marco perfil={perfil}>
      <p className="eyebrow text-piedra mb-3">{esAdmin ? 'FIRMA' : organizacion?.nombre}</p>
      <h1 className="h2 mb-2">Hola{nombre ? `, ${nombre}` : ''}</h1>
      <p className="text-piedra mb-10">
        <Etiqueta tono="bosque">{ROTULO_ROL[perfil.rol]}</Etiqueta>
      </p>

      <div className="grid gap-px bg-[rgba(27,31,27,0.15)] border border-[rgba(27,31,27,0.15)] tab:grid-cols-2 wide:grid-cols-3">
        {visibles.map((m) => {
          const Icono = m.icono;
          const disponible = Boolean(m.ruta);
          const contenido = (
            <>
              <Icono size={22} className={disponible ? 'text-bosque' : 'text-calido'} />
              <h2 className="h3 mt-4 mb-2">{m.titulo}</h2>
              <p className="text-sm text-piedra">{m.texto}</p>
              {!disponible && (
                <span className="mt-4 inline-block">
                  <Etiqueta>Próximamente</Etiqueta>
                </span>
              )}
            </>
          );
          return disponible ? (
            <a
              key={m.titulo}
              href={m.ruta}
              target={m.externo ? '_blank' : undefined}
              rel={m.externo ? 'noopener' : undefined}
              onClick={(e) => {
                if (m.externo) return;
                e.preventDefault();
                navegar(m.ruta!);
              }}
              className="block bg-marfil p-6 hover:bg-white transition-colors"
            >
              {contenido}
            </a>
          ) : (
            <div key={m.titulo} className="bg-marfil p-6">
              {contenido}
            </div>
          );
        })}
      </div>
    </Marco>
  );
};
