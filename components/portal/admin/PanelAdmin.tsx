import React from 'react';
import { navegar } from '../navegacion';
import { Marco } from '../ui';
import type { Perfil } from '../tipos';
import { Usuarios } from './Usuarios';
import { Clientes } from './Clientes';
import { Registro } from './Registro';

const PESTANAS = [
  { ruta: '/portal/admin', titulo: 'Usuarios' },
  { ruta: '/portal/admin/clientes', titulo: 'Clientes' },
  { ruta: '/portal/admin/registro', titulo: 'Registro de accesos' },
];

export const PanelAdmin: React.FC<{ perfil: Perfil; ruta: string }> = ({ perfil, ruta }) => (
  <Marco perfil={perfil}>
    <p className="eyebrow text-piedra mb-3">Panel de administración</p>
    <h1 className="h2 mb-8">Accesos al portal</h1>
    <nav className="flex gap-6 mb-8 text-sm font-medium overflow-x-auto" style={{ borderBottom: '1px solid rgba(27,31,27,0.15)' }}>
      {PESTANAS.map((p) => {
        const activa = ruta === p.ruta;
        return (
          <a
            key={p.ruta}
            href={p.ruta}
            onClick={(e) => {
              e.preventDefault();
              navegar(p.ruta);
            }}
            className={`pb-3 -mb-px whitespace-nowrap border-b-2 ${activa ? 'border-bosque text-bosque' : 'border-transparent hover:text-bosque'}`}
          >
            {p.titulo}
          </a>
        );
      })}
    </nav>
    {ruta === '/portal/admin/clientes' ? <Clientes /> : ruta === '/portal/admin/registro' ? <Registro /> : <Usuarios yo={perfil} />}
  </Marco>
);
