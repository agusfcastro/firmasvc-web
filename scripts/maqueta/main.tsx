/**
 * Pantallas de la maqueta (?pantalla=crm por ahora). Ver vite.config.ts.
 * ?vista=tiempo o ?vista=lista elige la vista de Clientes; ?panel=cerrado oculta el panel.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './maqueta.css';
import '@fontsource-variable/archivo/wdth.css';
import { Marco } from '../../components/portal/ui';
import { Listado } from '../../components/portal/crm/Listado';
import { ORG, PERFIL } from './datos';

const q = new URLSearchParams(window.location.search);
try {
  window.localStorage.setItem('firma-crm-vista', q.get('vista') === 'lista' ? 'lista' : 'tiempo');
  window.localStorage.setItem('firma-panel-seccion', q.get('panel') === 'cerrado' ? 'cerrado' : 'abierto');
  window.localStorage.setItem('firma-crm-por-pagina', '20');
} catch {
  /* sin almacenamiento */
}
window.history.replaceState(null, '', `/portal/crm${window.location.search}`);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Marco perfil={PERFIL}>
      <Listado orgId={ORG} orgNombre="Empresa Demo" cobranza verCasos />
    </Marco>
  </React.StrictMode>,
);
