import React, { Suspense, lazy, useEffect } from 'react';
import { Button } from '../Button';
import { supabase } from './supabase';
import { navegar, useRuta } from './navegacion';
import { useSesion } from './useSesion';
import { Aviso, Cargando, Marco } from './ui';
import { Ingresar } from './Ingresar';
import { DefinirClave } from './DefinirClave';
import { Inicio } from './Inicio';

const CrmApp = lazy(() => import('./crm/CrmApp'));
const PanelAdmin = lazy(() => import('./admin/PanelAdmin').then((m) => ({ default: m.PanelAdmin })));

/**
 * Portal de clientes FIRMA. Rutas
 *   /portal/ingresar   login
 *   /portal/clave      definir o cambiar contraseña (desde el enlace del mail)
 *   /portal            inicio según rol
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
      <Marco ancho="angosto">
        <h1 className="h2 mb-6">Portal sin configurar</h1>
        <Aviso tipo="error">Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Revisá la guía PORTAL.md.</Aviso>
      </Marco>
    );
  }

  if (cargando) return <Cargando />;
  if (ruta === '/portal/clave') return <DefinirClave estado={estado} />;
  if (!sesion) return <Ingresar />;

  if (!perfil || !perfil.activo || (perfil.rol !== 'admin' && !estado.organizacion)) {
    return (
      <Marco ancho="angosto">
        <h1 className="h2 mb-6">Tu cuenta no está habilitada</h1>
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
      </Marco>
    );
  }

  if (ruta === '/portal/crm' || ruta.startsWith('/portal/crm/')) {
    return (
      <Suspense fallback={<Cargando />}>
        <CrmApp perfil={perfil} organizacion={estado.organizacion} ruta={ruta} />
      </Suspense>
    );
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
