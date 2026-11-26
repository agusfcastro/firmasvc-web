/** Pantallas de Administración. Las usan las pestañas de PanelAdmin y el panel de la barra lateral. */
export const PESTANAS_ADMIN = [
  { ruta: '/portal/admin', titulo: 'Usuarios' },
  { ruta: '/portal/admin/clientes', titulo: 'Clientes' },
  { ruta: '/portal/admin/agendas', titulo: 'Agendas' },
  { ruta: '/portal/admin/documentos', titulo: 'Documentos' },
  { ruta: '/portal/admin/formularios', titulo: 'Formularios' },
  { ruta: '/portal/admin/abonos', titulo: 'Abonos' },
  { ruta: '/portal/admin/newsletter', titulo: 'Newsletter' },
  { ruta: '/portal/admin/calidad', titulo: 'Calidad de la IA' },
  { ruta: '/portal/admin/registro', titulo: 'Registro de accesos' },
] as const;
