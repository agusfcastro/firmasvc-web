/**
 * Pantallas de la maqueta. Ver vite.config.ts.
 *   ?pantalla=crm            Clientes (?vista=tiempo o lista, ?panel=cerrado oculta el panel)
 *   ?pantalla=documentos     Documentos visto por FIRMA (?seccion=equipo u otros, ?empresa=<id>)
 *   ?pantalla=alta           Alta de un cliente en el CRM, para ver los campos
 *   ?pantalla=firmas         Firmas visto por FIRMA
 *   ?pantalla=admin-documentos  Administración › Documentos
 *   ?ruta=/portal/crm/...    cualquier pantalla del CRM como la ve el titular (ficha, casos, reuniones…)
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './maqueta.css';
import '@fontsource-variable/archivo/wdth.css';
import { Marco } from '../../components/portal/ui';
import { Listado } from '../../components/portal/crm/Listado';
import { Documentos } from '../../components/portal/Documentos';
import { AltaCliente } from '../../components/portal/crm/AltaCliente';
import { Firmas } from '../../components/portal/firmas/Firmas';
import { PanelAdmin } from '../../components/portal/admin/PanelAdmin';
import { CrmApp } from '../../components/portal/crm/CrmApp';
import { ORG, PERFIL, PERFIL_FIRMA } from './datos';
import type { Organizacion, Perfil } from '../../components/portal/tipos';

const q = new URLSearchParams(window.location.search);
const pantalla = q.get('pantalla') ?? 'crm';
try {
  window.localStorage.setItem('firma-crm-vista', q.get('vista') === 'lista' ? 'lista' : 'tiempo');
  window.localStorage.setItem('firma-panel-seccion', q.get('panel') === 'cerrado' ? 'cerrado' : 'abierto');
  window.localStorage.setItem('firma-crm-por-pagina', '20');
} catch {
  /* sin almacenamiento */
}

const org = { id: ORG, nombre: 'Empresa Demo', plan: 'eminent', monedas: ['USD'] } as unknown as Organizacion;
const firma = PERFIL_FIRMA as unknown as Perfil;
const titular = PERFIL as unknown as Perfil;
const empresa = q.get('empresa');
const seccion = q.get('seccion');

let ruta = '/portal/crm';
let contenido: React.ReactNode = (
  <Marco perfil={titular}>
    <Listado orgId={ORG} orgNombre="Empresa Demo" cobranza verCasos />
  </Marco>
);
const rutaCrm = q.get('ruta');
if (rutaCrm?.startsWith('/portal/crm')) {
  ruta = rutaCrm;
  contenido = <CrmApp perfil={titular} organizacion={org} ruta={ruta} />;
} else if (pantalla === 'documentos') {
  ruta = seccion ? `/portal/documentos/${seccion}` : '/portal/documentos';
  contenido = <Documentos perfil={firma} organizacion={null} ruta={ruta} />;
} else if (pantalla === 'alta') {
  ruta = '/portal/crm/nuevo';
  contenido = (
    <Marco perfil={titular}>
      <AltaCliente orgId={ORG} esAdmin={false} orgNombre="Empresa Demo" cobranza monedas={['USD']} />
    </Marco>
  );
} else if (pantalla === 'firmas') {
  ruta = '/portal/firmas';
  contenido = <Firmas perfil={firma} organizacion={null} ruta={ruta} />;
} else if (pantalla === 'admin-documentos') {
  ruta = '/portal/admin/documentos';
  contenido = <PanelAdmin perfil={firma} ruta={ruta} />;
}
window.history.replaceState(null, '', `${ruta}${empresa ? `?empresa=${empresa}` : ''}`);
// Las pantallas del CRM se mueven con navegar(): se vuelve a pintar la de la dirección nueva.
if (rutaCrm) window.addEventListener('popstate', () => window.location.replace(`/?ruta=${encodeURIComponent(window.location.pathname)}`));

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{contenido}</React.StrictMode>);
