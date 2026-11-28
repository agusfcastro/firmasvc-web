import React from 'react';
import { Encabezado, Marco, NavegacionDePagina, PestanasEnlace } from '../ui';
import { PESTANAS_ADMIN } from './pestanas';
import type { Perfil } from '../tipos';
import { Usuarios } from './Usuarios';
import { Clientes } from './Clientes';
import { Registro } from './Registro';
import { Agendas } from './Agendas';
import { Documentos } from './Documentos';
import { Formularios } from './Formularios';
import { Abonos } from './Abonos';
import { NewsletterAdmin } from './Newsletter';
import { CalidadIa } from './CalidadIa';


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
      <NavegacionDePagina>
        <PestanasEnlace etiqueta="Secciones de Administración" items={PESTANAS_ADMIN.map((p) => ({ a: p.ruta, titulo: p.titulo, activa: ruta === p.ruta }))} />
      </NavegacionDePagina>
      {ruta === '/portal/admin/clientes' ? <Clientes /> : ruta === '/portal/admin/agendas' ? <Agendas /> : ruta === '/portal/admin/documentos' ? <Documentos /> : ruta === '/portal/admin/formularios' ? <Formularios /> : ruta === '/portal/admin/abonos' ? <Abonos /> : ruta === '/portal/admin/newsletter' ? <NewsletterAdmin /> : ruta === '/portal/admin/calidad' ? <CalidadIa /> : ruta === '/portal/admin/registro' ? <Registro /> : <Usuarios yo={perfil} />}
    </div>
  </Marco>
);
