# Estado actual del repositorio

Relevamiento del 5 de noviembre de 2026, antes de empezar la Fase 1 de Tina. Sale de leer el código, las 58 migraciones de `supabase/migrations/` y `PORTAL.md`, que es la documentación de uso y puesta en marcha de cada módulo. No se cambió código.

## Glosario, cómo se llama cada cosa en el código

`CLAUDE.md` usa nombres genéricos. En el repo las cosas ya tienen nombre propio, y conviene construir a Tina con estos.

| En `CLAUDE.md` | En el código |
| --- | --- |
| Cliente de FIRMA (la empresa que contrata) | `organizaciones`, en pantalla «empresa» o «negocio» |
| `client_id` | `organizacion_id` |
| Usuario | `perfiles` (uno por cuenta de `auth.users`) más `membresias` (una persona puede estar en varios negocios) |
| `account_manager` | Rol de portal `csm`. En el equipo comercial existe además `account_manager` como `rol_comercial` |
| Cliente del cliente (alumno, comprador) | `crm_clientes` |
| Casos y conflictos | `asuntos` (todo trámite con FIRMA) y `crm_casos` (casos de conflicto, reembolsos y contracargos) |
| Responsable de un cliente del CRM | `crm_clientes.responsable_id`, que apunta a `equipo_miembros` |

## Estructura de carpetas

| Carpeta | Qué tiene |
| --- | --- |
| `App.tsx`, `index.tsx`, `entry-server.tsx` | Entrada de la app. La web pública se prerenderiza (`scripts/prerender.mjs`) y todo lo demás cae en `app.html` |
| `components/` | Web pública (Hero, Planes, Contact y demás) |
| `components/portal/` | Portal de clientes. `PortalApp.tsx` resuelve las rutas, `useSesion.ts` la sesión y el perfil, `ui.tsx` el marco visual |
| `components/portal/admin/` | Panel de FIRMA |
| `components/portal/crm/` | CRM legal de cada empresa |
| `components/portal/firmas/`, `components/firma/` | Firma electrónica propia (panel y página pública de firma y verificación) |
| `components/portal/pedidos/` | Formulario de pedido de contrato de closer |
| `components/protocolos/` | Ocho protocolos públicos con un motor común |
| `components/comprobantes/` | Herramienta de recibos y comprobantes |
| `api/` | Funciones serverless de Vercel |
| `api/_lib/` | Código compartido del servidor (mail, acceso, cola, variables de contratos, Word a PDF, colores de marca) |
| `supabase/migrations/` | 58 migraciones numeradas `NNNN_descripcion.sql` |
| `supabase/pruebas/` | Pruebas SQL de permisos que corren con `npm run db:probar` |
| `scripts/` | Prerender, pruebas de base sobre PGlite y verificación de colores |
| `public/` | Robots, sitemap, imágenes de los mails y videos |
| `design_handoff_firma_home/` | Material de diseño de la home |
| `.github/workflows/verificar.yml` | En cada push corre typecheck, verificación de marca, pruebas de base y las migraciones sobre la imagen real de Supabase |

## Backend

Todo el backend son **rutas `/api` de Vercel** en TypeScript. No hay Edge Functions de Supabase (no existe `supabase/functions`). Lo que no hace la API lo hace la base con funciones SQL, triggers y `pg_cron`.

| Ruta | Para qué |
| --- | --- |
| `api/admin/usuarios.ts` | Invitar, editar, activar y desactivar usuarios |
| `api/portal/avisos.ts` | Avisos por mail de asuntos, chat y documentos |
| `api/portal/recuperar.ts` | Mail de «Olvidé mi contraseña» |
| `api/portal/resumen.ts` | Tarea diaria con alertas de vencimientos y el mail de los lunes |
| `api/firma/sobres.ts`, `api/firma/firmar.ts` | Firma electrónica, contratos del CRM, sellado |
| `api/pagos/*` | Abonos y cobro con dLocal Go |
| `api/webhooks/fathom.ts` | Llamadas de Fathom |
| `api/cola/procesar.ts` | Procesa la cola de trabajos (`cola_trabajos`) |

Patrón que siguen las funciones que atienden a usuarios.

1. Leen el token del usuario del header `Authorization`.
2. Con `clienteDelUsuario(request)` de `api/_lib/acceso.ts` crean un cliente de Supabase con ese token, así las lecturas pasan por las mismas políticas RLS que el portal.
3. Con `accesoVigente` comprueban que perfil, negocio y membresía estén activos.
4. Las escrituras de sistema (bitácora, eventos, registros) usan la clave de servicio, después de validar quién pide y qué.
5. Las cuentas admin exigen verificación en dos pasos (`aal2`), y la API lo controla con `api/_lib/nivel.ts`.

Los imports relativos dentro de `api/` llevan la extensión `.js`.

**Tareas programadas.** Vercel Cron corre dos tareas una vez por día (`vercel.json`), la firma a las 13 UTC y el resumen a las 12 UTC. Además, `pg_cron` en Supabase corre `cola_barrer` cada minuto. El plan Hobby de Vercel solo permite crons diarios, así que un proceso «cada hora» para el resumen de las 7 tendría que ir por `pg_cron` o requerir Vercel Pro.

## Tablas y permisos

Todas las tablas tienen RLS activado. Los permisos se apoyan en funciones SQL comunes.

| Función | Qué devuelve |
| --- | --- |
| `es_admin()` / `es_staff()` | Rol admin, activo y con verificación en dos pasos |
| `mi_organizacion()`, `mi_rol()`, `mis_areas()` | Negocio activo, rol y áreas de quien llama |
| `puede_ver_org(org)` | Admin, o el negocio es el propio y el rol es titular, csm, closer o miembro |
| `puede_gestionar_org(org)` | Admin, o titular del negocio |
| `puede_ver_casos(org)` | Admin, o titular o csm del negocio |
| `es_de_mi_cartera(org, cliente)` | Quien llama es el responsable de ese cliente del CRM (0057) |
| `tiene_funcionalidad(org, clave)` | El plan del negocio incluye esa funcionalidad |
| `acceso_vigente(usuario)` | Negocio activo solo si perfil, negocio y membresía están activos |

Además, la migración 0038 hace que las tablas hijas apunten al padre por `(organizacion_id, id)`, así la base rechaza que un registro apunte a algo de otro negocio. `supabase/pruebas/aislamiento_negocios.sql` comprueba que un negocio no lee ni escribe datos de otro.

| Tabla | Para qué | Quién la ve (resumen de RLS) |
| --- | --- | --- |
| `organizaciones` | Empresas cliente, con plan, plan de producto, logo, país, prefijo, firmante | Admin todas. Cada usuario la suya |
| `perfiles` | Usuario, rol, negocio activo, áreas, staff | Cada uno el suyo. Admin todos |
| `membresias` | Persona en varios negocios con rol y áreas | La propia. Admin todas |
| `areas` | Áreas de documentos | Lectura general |
| `registro_accesos` | Bitácora encadenada por hash e inmutable | Admin todo. Titular la de su negocio |
| `equipo_miembros` | Closers, setters, account managers y CSM de cada negocio | Todo el negocio. Administra el titular |
| `crm_clientes` (+ vista `crm_clientes_resumen`) | Clientes del cliente. DNI, teléfono y domicilio cifrados | `puede_ver_org`. Borra solo admin |
| `crm_servicios` | Lo que vende cada empresa, con modelo de contrato | Negocio. Edita el titular |
| `crm_contratos`, `crm_contratos_firma` | Contratos del CRM | FIRMA y titular |
| `crm_pagos` | Plan de pagos de cada cliente del CRM | Negocio |
| `crm_historial` | Historial de cambios de la ficha | Negocio |
| `crm_casos` | Casos de conflicto, reembolsos y contracargos | `puede_ver_casos` (sin closer ni setter) |
| `crm_borradores`, `zapsign_cuentas` | Restos de flujos retirados, sin uso | Admin |
| `asuntos`, `asunto_novedades`, `asunto_mensajes`, `asunto_archivos` | Trámites con FIRMA, bitácora, chat en vivo y archivos | `puede_ver_casos` o cartera del responsable. Notas internas solo admin |
| `pedidos_contrato`, `esquemas_contrato` | Formulario de contrato de closer y esquemas guardados | Titular y csm. Bloqueado después de enviar |
| `documentos` | Biblioteca, común o por empresa, con casilla de protocolo o formación | `documento_visible` según rol y áreas |
| `firma_sobres`, `firma_firmantes`, `firma_eventos` | Firma electrónica con eventos encadenados e inmutables | Negocio y FIRMA. Eventos de solo lectura |
| `abonos`, `abono_pagos` | Abono de cada empresa y sus cobros. Desde la 0061 con el esquema de la oferta (cuotas o pago completo, pesos al MEP) | Titular y FIRMA |
| `agendas`, `agenda_consumos` | Enlaces de agenda y minutos consumidos por plan | Negocio. Carga FIRMA |
| `newsletters`, `avisos_programados` | Mail de los lunes y registro de lo que ya salió | Admin. `avisos_programados` solo servidor |
| `org_variables_def`, `org_variables_valor` | Variables propias de los contratos de cada negocio | Negocio. Edita el titular |
| `funcionalidades`, `planes_funcionalidades`, `planes_servicio_funcionalidades`, `org_funcionalidades` | Qué incluye cada plan y excepciones por negocio | Lectura. Edita admin |
| `arquetipos`, `senal_tipos`, `perfil_senales`, `perfiles_conductuales` | Perfil conductual de clientes del CRM | Titular, csm y FIRMA, con la funcionalidad |
| `integraciones`, `webhook_recepciones`, `interacciones` | Conexiones de Fathom y llamadas cifradas | Según rol, ver `PORTAL.md` |
| `cola_trabajos` | Cola de trabajos del servidor | Solo FIRMA lee. Escribe el servidor |
| `comprobantes`, `comprobantes_emisor`, `comprobantes_numeracion` | Recibos y comprobantes de cada negocio | Negocio |

Buckets de Storage `asuntos`, `documentos`, `firmas` y `modelos` (privados) y `logos` (público).

Secretos en Supabase Vault `crm_datos` y `crm_indices` (cifrado del CRM), `interacciones_contenido`, y `cola_url` y `cola_secreto` (barrido de la cola).

**Estado en producción.** Según el registro de trabajo, están aplicadas hasta la 0056 y la 0058. La **0057 (asuntos de la cartera) está pendiente** desde el 4 de noviembre.

## Roles

El rol vive en el enum `rol_portal` y se guarda en `perfiles.rol` y en cada membresía.

| Rol | Qué ve hoy |
| --- | --- |
| `admin` | Todo, con verificación en dos pasos obligatoria. No puede tener negocio asignado |
| `titular` | Todo lo de su empresa, incluidos equipo, pagos, servicios y bitácora |
| `csm` | Todo menos la administración. Si tiene áreas, los documentos se limitan a esas |
| `closer` | CRM y agenda, sin casos de conflicto. Documentos solo de protocolo y formación |
| `setter` | Solo protocolos y formación |
| `miembro` | Rol viejo, funciona como `csm` |

Además, desde la 0057 el responsable de un cliente del CRM ve los asuntos de ese cliente aunque su rol no vea Asuntos.

## Planes

Hoy conviven dos ejes.

| Eje | Columna | Valores | Qué define |
| --- | --- | --- | --- |
| Plan de servicio | `organizaciones.plan` (obligatorio) | `starter`, `eminent` desde la 0059 | Agenda (60 min por semana o sin límite) y cupo de firmas (20 o sin límite) |
| Plan de producto | `organizaciones.plan_producto` | `radar`, `escudo`, `blindaje` | Funcionalidades nuevas, como Fathom y perfiles conductuales |

Starter reemplazó a Gold y Black en la 0059. Los abonos cobran la oferta de `CLAUDE.md` desde la 0061.

## Secciones del portal

| Sección | Ruta | Estado |
| --- | --- | --- |
| Ingreso, contraseña, segundo factor | `/portal/ingresar`, `/portal/clave` | En producción |
| Inicio | `/portal` | En producción. Muestra pendientes reales por rol (firmas, asuntos, pedidos, débitos) y los onboardings del día |
| CRM legal | `/portal/crm/...` | En producción. Listado, ficha, alta, servicios, variables, equipo, casos de conflicto, comprobantes, llamadas |
| Llamadas de Fathom | `/portal/crm/llamadas` | Recepción y vínculo funcionando. Análisis con Claude pendiente (fase 5). Faltan verificar campos con una cuenta real |
| Documentos y Protocolos | `/portal/documentos`, `/portal/protocolos` | En producción. Los videos de protocolos no están cargados |
| Firma electrónica | `/portal/firmas` | En producción, con registro de auditoría encadenado y sello |
| Asuntos | `/portal/asuntos` | En producción, con chat en vivo, bitácora y documentos. Cartera del responsable pendiente de la 0057 |
| Pedidos de contrato | `/portal/pedidos/closer` | En producción, solo modelo de closer |
| Agenda | `/portal/agenda` | En producción |
| Pagos | `/portal/pagos` | En producción con dLocal Go. Cuotas, pago completo y pesos al MEP desde la 0061, pendientes de probar en sandbox |
| Bitácora | `/portal/bitacora` | En producción, solo titular |
| Administración | `/portal/admin/...` | Clientes, Usuarios, Agendas, Documentos, Abonos, Newsletter y Registro |

**App instalable y notificaciones push** desde el 14/11/2026: manifest, service worker y avisos de asuntos, documentos, onboardings, firmas y derivaciones de Tina. Detalle en `PORTAL.md`, sección App instalable y notificaciones. Necesita `VAPID_PRIVATE_KEY` en Vercel.

## Mail

Todo sale por **Resend**, con una sola plantilla de marca en `api/_lib/mail.ts` (`plantillaMail` y `enviarMail`). La firma electrónica usa el mismo servicio. Si falta `RESEND_API_KEY`, Supabase manda solo las invitaciones, sin la marca.

Lo que ya existe y se parece al resumen diario es `api/portal/resumen.ts`, que corre todos los días a las 9 de Buenos Aires y manda alertas de vencimientos y, los lunes, un mail con newsletter, vencimientos de la semana y resumen. Ese mail lleva newsletter, o sea, contenido que no es operativo.

## Variables de entorno

Solo nombres. Las que empiezan con `VITE_` llegan al navegador; el resto vive solo en el servidor.

| Variable | Dónde se usa |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Portal y, como respaldo, servidor |
| `VITE_META_PIXEL_ID` | Píxel de Meta en la web pública |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Servidor |
| `PORTAL_URL` | Enlaces en mails |
| `RESEND_API_KEY`, `PORTAL_MAIL_DIRECCION`, `FIRMA_MAIL_DIRECCION` | Mails |
| `DLOCALGO_API_KEY`, `DLOCALGO_SECRET_KEY`, `DLOCALGO_ENTORNO`, `DLOCALGO_CLAVE_AVISOS` | Pagos |
| `GOOGLE_CREDS_JSON`, `GOOGLE_SUBJECT` | Paso de Word a PDF con Drive |
| `CRON_SECRET` | Tareas de Vercel Cron |
| `FIRMA_CLAVE_FIRMAS` | Firma electrónica |
| `PORTAL_CLAVE_AVISOS` | Enlaces de baja del mail de los lunes |
| `COLA_SECRETO` | Opcional, barrido de la cola |

Para Tina van a hacer falta, como mínimo, `ANTHROPIC_API_KEY` y las claves VAPID de push.

## Decisiones de Agustín, 5 de noviembre de 2026

Respuestas a las dudas del relevamiento. Mandan sobre lo que diga cualquier otro documento.

1. **Planes.** No hay clientes en Gold ni Black. Todos son Eminent. Starter queda para clientes nuevos.
2. **CSM y account manager son lo mismo.** Se unifican en un solo rol.
3. **Contratos.** Los generan solo el titular y quienes tengan el área Legales u Operaciones (además de FIRMA). Tina no arma «fichas» aparte. Recibe los datos de una venta, carga al cliente en el CRM y, cuando corresponde y el usuario tiene permiso, devuelve el enlace de firma.
4. **Resumen diario.** Se suma a las alertas de vencimientos. La newsletter de los lunes sigue saliendo aparte.
5. **Horario.** El resumen sale a las 7 de Argentina para todos, de lunes a viernes. No hace falta zona horaria por cliente por ahora.
6. **Responsable.** El teléfono que pasa Tina es el de la persona de FIRMA asignada al cliente. Hoy es Agustín para todos.
7. **Recursos.** Tina busca en los protocolos, en la biblioteca de documentos y en documentos que FIRMA le cargue como contexto.
8. **Contratos que consulta Tina.** Todos, los modelos de cada servicio, los firmados y el de la empresa con FIRMA.
9. **Migración 0057.** Se aplica en producción antes de empezar.

## Diferencias entre `CLAUDE.md` y el código

1. **Planes.** Resuelto con la 0059 (Starter y Eminent) y la 0061 (abonos con la oferta). Quedan los planes de producto Radar, Escudo y Blindaje, que `CLAUDE.md` no menciona.
2. **Roles.** `account_manager` no es un rol del portal; el más parecido es `csm`.
3. **Contratos.** La regla 1 dice que solo `admin` genera contratos. Hoy cualquier rol con acceso al CRM, closer incluido, genera el contrato desde el modelo del servicio y lo manda a firmar.
4. **Resumen.** Ya existe un mail diario de alertas y uno de los lunes con newsletter. La regla 5 dice que el resumen diario no lleva marketing.
5. **Datos de la empresa.** `organizaciones` no tiene zona horaria, teléfono del responsable ni tipo societario, que el prompt de Tina usa.
