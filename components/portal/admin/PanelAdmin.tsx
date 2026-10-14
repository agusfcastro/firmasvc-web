import React from 'react';
import { Encabezado, Enlace, Marco } from '../ui';
import type { Perfil } from '../tipos';
import { Usuarios } from './Usuarios';
import { Clientes } from './Clientes';
import { Registro } from './Registro';
import { Agendas } from './Agendas';

const PESTANAS = [
  { ruta: '/portal/admin', titulo: 'Usuarios' },
  { ruta: '/portal/admin/clientes', titulo: 'Clientes' },
  { ruta: '/portal/admin/agendas', titulo: 'Agendas' },
  { ruta: '/portal/admin/registro', titulo: 'Registro de accesos' },
];

export const PanelAdmin: React.FC<{ perfil: Perfil; ruta: string }> = ({ perfil, ruta }) => (
  <Marco perfil={perfil}>
    <Encabezado
      eyebrow="Administración"
      titulo={
        <>
          Accesos al <span className="text-bosque">portal</span>
        </>
      }
      bajada="Empresas, usuarios y permisos de todos tus clientes. Desde acá también podés ver el portal como lo ve cada uno."
    />
    <div className="wrap py-10 desk:py-12 flex flex-col gap-8">
      <nav className="flex gap-6 overflow-x-auto scrollbar-hide" style={{ borderBottom: '1px solid rgba(27,31,27,0.15)' }}>
        {PESTANAS.map((p) => {
          const activa = ruta === p.ruta;
          return (
            <Enlace
              key={p.ruta}
              a={p.ruta}
              aria-current={activa ? 'page' : undefined}
              className={`pb-3 -mb-px text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-150 ${activa ? 'border-bosque text-bosque' : 'border-transparent text-piedra hover:text-tinta'}`}
            >
              {p.titulo}
            </Enlace>
          );
        })}
      </nav>
      {ruta === '/portal/admin/clientes' ? <Clientes /> : ruta === '/portal/admin/agendas' ? <Agendas /> : ruta === '/portal/admin/registro' ? <Registro /> : <Usuarios yo={perfil} />}
    </div>
  </Marco>
);
