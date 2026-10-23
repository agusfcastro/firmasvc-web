import React, { Suspense, lazy, useEffect } from 'react';
import { Button } from '../Button';
import { supabase } from './supabase';
import { navegar, useRuta } from './navegacion';
import { useSesion } from './useSesion';
import { Aviso, Cargando } from './ui';
import { LayoutAcceso } from './LayoutAcceso';
import { Ingresar } from './Ingresar';
import { DefinirClave } from './DefinirClave';
import { Inicio } from './Inicio';
import { Agenda } from './Agenda';
import { Documentos } from './Documentos';
import { Pagos } from './Pagos';
import { VistaPreviaContexto, leerVistaPrevia } from './vistaPrevia';
import { permisosDe, type Organizacion, type Perfil } from './tipos';

const CrmApp = lazy(() => import('./crm/CrmApp'));
const Firmas = lazy(() => import('./firmas/Firmas'));
const Asuntos = lazy(() => import('./EstadoAsuntos'));
const PanelAdmin = lazy(() => import('./admin/PanelAdmin').then((m) => ({ default: m.PanelAdmin })));

/**
 * Portal de clientes FIRMA. Rutas
 *   /portal/ingresar   login
 *   /portal/clave      definir o cambiar contraseña (desde el enlace del mail)
 *   /portal            inicio según rol
 *   /portal/documentos contratos de servicio, con el equipo y otros (más /equipo y /otros)
 *   /portal/firmas     firma electrónica propia (más /nuevo y /<id>)
 *   /portal/pagos      abonos mensuales con tarjeta (solo titular y admin)
 *   /portal/admin/...  panel de administración (solo admin)
 */
export const PortalApp: React.FC = () => {
  const ruta = useRuta();
  const estado = useSesion();
  const { cargando, sesion, perfil, vieneDeEnlace } = estado;

  useEffect(() => {
    const previo = document.title;
    document.title = 'Portal de clientes · FIRMA';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      document.title = previo;
      meta.remove();
    };
  }, []);

  // Redirecciones según la sesión.
  useEffect(() => {
    if (cargando || !supabase) return;
    if (!sesion && ruta !== '/portal/ingresar' && ruta !== '/portal/clave') navegar('/portal/ingresar');
    else if (sesion && ruta === '/portal/ingresar') navegar('/portal');
    else if (sesion && vieneDeEnlace && ruta !== '/portal/clave') navegar('/portal/clave');
  }, [cargando, sesion, ruta, vieneDeEnlace]);

  if (!supabase) {
    return (
      <LayoutAcceso>
        <h1 className="h2 mb-6">Portal sin configurar</h1>
        <Aviso tipo="error">Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Revisá la guía PORTAL.md.</Aviso>
      </LayoutAcceso>
    );
  }

  if (cargando) return <Cargando />;
  if (ruta === '/portal/clave') return <DefinirClave estado={estado} />;
  if (!sesion) return <Ingresar />;

  if (!perfil || !perfil.activo || (perfil.rol !== 'admin' && !estado.organizacion)) {
    return (
      <LayoutAcceso>
        <p className="eyebrow text-piedra mb-4">Acceso</p>
        <h1 className="h2 mb-6">
          Tu cuenta no está <span className="text-bosque">habilitada</span>
        </h1>
        <p className="text-piedra mb-8">Ingresaste como {sesion.user.email}, pero esta cuenta no tiene acceso activo al portal. Escribinos y lo revisamos.</p>
        <Button
          variant="ghost"
          onClick={async () => {
            await supabase?.auth.signOut();
            navegar('/portal/ingresar');
          }}
        >
          Salir
        </Button>
      </LayoutAcceso>
    );
  }

  // Modo "Ver como": el admin navega con la perspectiva de un cliente.
  const vista = perfil.rol === 'admin' ? leerVistaPrevia() : null;
  if (vista) {
    const perfilVista: Perfil = { ...perfil, rol: vista.rol, organizacion_id: vista.orgId, areas: vista.areas, nombre: vista.nombre ?? perfil.nombre, cargo: null };
    const orgVista = { id: vista.orgId, nombre: vista.orgNombre, activa: true } as Organizacion;
    const permisosVista = permisosDe(vista.rol);
    const enCrm = (ruta === '/portal/crm' || ruta.startsWith('/portal/crm/')) && permisosVista.crm;
    const enDocumentos = ruta === '/portal/documentos' || ruta.startsWith('/portal/documentos/');
    const enFirmas = (ruta === '/portal/firmas' || ruta.startsWith('/portal/firmas/')) && permisosVista.documentosLegales;
    const enAsuntos = (ruta === '/portal/asuntos' || ruta.startsWith('/portal/asuntos/')) && permisosVista.casos;
    return (
      <VistaPreviaContexto.Provider value={vista}>
        {enCrm ? (
          <Suspense fallback={<Cargando />}>
            <CrmApp perfil={perfilVista} organizacion={orgVista} ruta={ruta} />
          </Suspense>
        ) : enFirmas ? (
          <Suspense fallback={<Cargando />}>
            <Firmas perfil={perfilVista} organizacion={orgVista} ruta={ruta} />
          </Suspense>
        ) : enAsuntos ? (
          <Suspense fallback={<Cargando />}>
            <Asuntos perfil={perfilVista} organizacion={orgVista} ruta={ruta} />
          </Suspense>
        ) : enDocumentos ? (
          <Documentos perfil={perfilVista} organizacion={orgVista} ruta={ruta} />
        ) : ruta === '/portal/agenda' && permisosVista.agenda ? (
          <Agenda perfil={perfilVista} organizacion={orgVista} />
        ) : ruta === '/portal/pagos' && permisosVista.gestion ? (
          <Pagos perfil={perfilVista} organizacion={orgVista} />
        ) : (
          <Inicio estado={{ ...estado, perfil: perfilVista, organizacion: orgVista }} />
        )}
      </VistaPreviaContexto.Provider>
    );
  }

  const permisos = permisosDe(perfil.rol);

  if ((ruta === '/portal/crm' || ruta.startsWith('/portal/crm/')) && permisos.crm) {
    return (
      <Suspense fallback={<Cargando />}>
        <CrmApp perfil={perfil} organizacion={estado.organizacion} ruta={ruta} />
      </Suspense>
    );
  }

  if (ruta === '/portal/documentos' || ruta.startsWith('/portal/documentos/')) {
    return <Documentos perfil={perfil} organizacion={estado.organizacion} ruta={ruta} />;
  }

  if ((ruta === '/portal/firmas' || ruta.startsWith('/portal/firmas/')) && permisos.documentosLegales) {
    return (
      <Suspense fallback={<Cargando />}>
        <Firmas perfil={perfil} organizacion={estado.organizacion} ruta={ruta} />
      </Suspense>
    );
  }

  if ((ruta === '/portal/asuntos' || ruta.startsWith('/portal/asuntos/')) && permisos.casos) {
    return (
      <Suspense fallback={<Cargando />}>
        <Asuntos perfil={perfil} organizacion={estado.organizacion} ruta={ruta} />
      </Suspense>
    );
  }

  if (ruta === '/portal/agenda' && permisos.agenda) return <Agenda perfil={perfil} organizacion={estado.organizacion} />;

  // Pagos solo para titulares y FIRMA. El resto del equipo vuelve al inicio.
  if (ruta === '/portal/pagos') {
    if (!permisos.gestion) return <Inicio estado={estado} />;
    return <Pagos perfil={perfil} organizacion={estado.organizacion} />;
  }

  if (ruta.startsWith('/portal/admin')) {
    if (perfil.rol !== 'admin') return <Inicio estado={estado} />;
    return (
      <Suspense fallback={<Cargando />}>
        <PanelAdmin perfil={perfil} ruta={ruta} />
      </Suspense>
    );
  }

  return <Inicio estado={estado} />;
};

export default PortalApp;
