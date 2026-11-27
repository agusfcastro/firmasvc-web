# FIRMA · Contexto del proyecto

Este archivo es la fuente de verdad para cualquier sesión de Claude que trabaje en este repositorio. Leelo completo antes de proponer o tocar código.

## Qué es

FIRMA (firmasvc.com) es la consultora legal de Agustín Castro, abogado matriculado en la CPACF, para infoproductores, agencias, fundadores de SaaS y pymes de Argentina, Estados Unidos y Perú.

El portal cumple dos roles. Es el canal del cliente y es la herramienta interna del equipo de FIRMA. Lo que se vende es Tina, una account manager con IA que vive en el portal y tiene un abogado detrás. El portal complementa los CRMs que ya usan los clientes, como Go High Level, y no compite con ellos.

## Stack

- Frontend en React, TypeScript y Vite, con deploy en Vercel.
- Base de datos, auth y storage en Supabase.
- IA con la API de Claude de Anthropic.
- Antes de proponer arquitectura, revisá cómo está resuelto hoy el backend (rutas `/api` de Vercel o Edge Functions de Supabase) y seguí ese mismo patrón.

## Roles

| Rol | Quién es | Qué puede hacer |
| --- | --- | --- |
| `admin` | Agustín y el equipo de FIRMA | Ve todos los clientes, genera contratos, valida fichas, atiende derivaciones |
| `titular` | Dueño de la cuenta cliente | Ve todo lo de su cuenta, recibe el resumen diario |
| `account_manager` | Equipo del cliente. Es lo mismo que CSM, en el código hoy se llama `csm` | Recibe el resumen diario y los avisos de onboarding |
| `closer`, `setter` | Equipo de ventas del cliente | Carga datos de cierres a través de Tina o del formulario |

Los contratos del CRM los generan y mandan a firmar solo `admin`, el `titular` y quienes tengan el área Legales u Operaciones. Nadie del cliente ve los modelos con sus variables ni los placeholders.

El rol viejo `miembro` se retiró en la migración 0066 y esas cuentas pasaron a `csm`. La misma migración borró las tablas sin uso `zapsign_cuentas` y `crm_borradores`.

En el código el cliente de FIRMA es `organizaciones` y `client_id` es `organizacion_id`. El glosario completo y el estado del repo están en `docs/ESTADO_ACTUAL.md`.

## Planes

| Plan | Tres cuotas | Pago completo | Después de los tres meses |
| --- | --- | --- | --- |
| Eminent | USD 1000 por mes | USD 2500 | USD 500 por mes, o bajar a Starter |
| Starter | USD 500 por mes | USD 1000 | USD 250 por mes |

En el código (`organizaciones.plan`) los planes de servicio son `starter` y `eminent` desde la migración 0059, que retiró Gold y Black. Starter trae 60 minutos de agenda por semana y 20 firmas por mes. Hoy todos los clientes son Eminent.

Las tablas de Tina están en la migración 0060 (`tina_conversaciones`, `tina_mensajes`, `tina_tickets`, `eventos_cliente`, `push_suscripciones`, las columnas `tina_*` de `documentos` y `organizaciones.responsable_id`). Sus pruebas están en `supabase/pruebas/tina.sql`.

El chat de Tina es `POST /api/tina/chat` (`api/tina/chat.ts`), con las herramientas en `api/_lib/tina/herramientas.ts`, el prompt armado desde `docs/TINA_SYSTEM_PROMPT.md` (`api/_lib/tina/prompt.ts`) y los precios en `api/_lib/tina/precios.ts`. Usa `claude-opus-5-5` con esfuerzo bajo y necesita `ANTHROPIC_API_KEY` en Vercel. Si se cambia el documento del prompt, se cambia lo que dice Tina.

El análisis de llamadas de venta está en la migración 0067 (`analisis_codigos`, `interaccion_analisis`). Corre en la cola (`interaccion_analizar` en `api/_lib/cola.ts`, con `api/_lib/analisis/`): `claude-haiku-5-5` clasifica la etapa y `claude-opus-5-5` codifica las de venta con `docs/ANALIZADOR_VENTA.md`, que sale de la skill perfil-riesgo-prospecto v1.1. El puntaje lo calcula la base (`analisis_puntuar`), nunca el modelo, y FIRMA aprueba cada análisis antes de que lo vea el negocio. Si se cambia el documento o un peso, se publica una versión nueva del libro de códigos. El detalle está en `PORTAL.md`, sección Análisis de llamadas de venta.

Los contratos con el equipo están en la migración 0068. Un documento de Contratos con tu equipo o un envío a firma se ata a una persona activa del equipo y lleva el vencimiento del contrato (`contrato_vence_el`), y la tarjeta muestra nombre completo, rol y vencimiento (`components/portal/firmas/ContratosEquipo.tsx`). Los ven solo `admin`, el `titular` y las áreas Legales u Operaciones. Los formularios de pedido de contrato propios de una empresa se arman sin código en Administración › Formularios (`modelos_contrato`, `components/portal/admin/Formularios.tsx`, `components/portal/pedidos/propio.ts`); closer y setter siguen escritos en el código. Al cargar un documento en Administración › Documentos, «¿Es su contrato modelo?» también ofrece los formularios propios de la empresa y «Sí, de otro rol», que crea el formulario con ese nombre y los datos de la persona y le ata el documento (`modelos_contrato.documento_id`). El detalle está en `PORTAL.md`, sección Pedidos de contrato. Pruebas en `supabase/pruebas/contratos_equipo_y_modelos.sql`.

La gente del equipo que no es closer, setter, account manager ni CSM lleva su rol escrito a mano desde la migración 0069 (`equipo_miembros.cargo`, cuarto argumento opcional de `equipo_sumar`). El rol se muestra siempre con `rolDe()` de `components/portal/crm/tipos.ts`. En Administración, Documentos ordena por `actualizado_en` con lo más nuevo arriba (`documentos.orden` quedó en la base sin uso), se filtra por empresa y tiene buscador; Usuarios y Documentos se abren filtrados con `?empresa=<id>`, que es como se llega desde cada fila de Clientes. Un usuario se elimina con la acción `eliminar` de `/api/admin/usuarios`, que pide su mail como confirmación, borra la cuenta y conserva lo que hizo.

Los comentarios de clientes en documentos de un asunto (migración 0065) se exportan desde el visor, solo FIRMA, con «Copiar todos» y «Descargar en Word» (`components/portal/comentarios/exportar.ts`). Los borradores de respuesta que Tina dejaba cada mañana para FIRMA (migración 0070) se retiraron el 25 de noviembre de 2026 para no gastar en la API: se sacaron la tarea diaria, los trabajos de la cola, el agente y la pantalla del visor. Las tablas `comentario_borradores` y afines quedaron en la base sin uso, con sus pruebas en `supabase/pruebas/borradores_comentarios.sql`.

Desde la migración 0071, FIRMA edita los Word de un asunto dentro del visor (`components/portal/editor/`): cada párrafo se escribe encima y el motor (`wordXml.ts`) cambia solo el texto dentro del archivo, sin tocar el formato. Lo guardado es un borrador que el cliente no ve; al publicar pasa a ser la versión vigente (`asunto_archivos.ruta`) y las anteriores quedan en `asunto_archivo_versiones`. Solo `admin` y solo `.docx`. El detalle está en `PORTAL.md`, sección Editar los Word de un asunto. Pruebas en `supabase/pruebas/versiones_documentos.sql` y `scripts/pruebas/wordXml.mjs`.

Desde la migración 0072 cada empresa cobra en las monedas que FIRMA le habilita en Administración › Clientes (`organizaciones.monedas`, hoy USD y PEN en `MONEDAS_CRM` de `components/portal/crm/tipos.ts`), y cada servicio lleva la moneda de su ticket (`crm_servicios.moneda`). Con más de una moneda, el alta, la ficha y los servicios muestran un selector; la base rechaza una moneda no habilitada cuando cambia, también desde Tina. Los soles salen como S/ en los contratos y en el portal (`simboloMoneda()` de `api/_lib/variables.ts`) y los totales del listado del CRM van por moneda, sin convertir. Pruebas en `supabase/pruebas/monedas.sql` y `scripts/pruebas/monedas.mjs`.

Desde la migración 0073 una empresa no puede tener dos clientes del CRM con el mismo nombre. La base compara sin mayúsculas, tildes ni espacios de más (`crm_nombre_normalizado`), y el alta y Tina avisan antes de guardar con el enlace a la ficha que ya existe (`crm_cliente_con_nombre`). Los repetidos de antes de la 0073 se siguen pudiendo editar. Con modalidad PIF el alta registra un único pago pagado por el total, sin anticipo, cuotas ni vencimiento, también desde Tina. En Firmas, FIRMA filtra por cliente y busca por documento o firmante, y cada fila de Administración › Clientes abre Firmas con `?empresa=`. El visor y el editor de Word cargan Archivo y Carlito (en lugar de Calibri) desde `public/fuentes`. Pruebas en `supabase/pruebas/cliente_nombre_unico.sql`.

Cada llamada a Claude del portal queda anotada desde la migración 0074 (`ia_corridas`, `api/_lib/ia/registro.ts`): agente, versión del prompt, modelo, tokens, costo y duración. La versión es la huella del texto que guía al agente (`api/_lib/ia/versiones.ts`), así un cambio de prompt se nota solo. La corrida no copia el contenido, apunta al registro donde ya está guardado (la conversación de Tina o el análisis). Anotar nunca cambia ni frena una respuesta. Las de Tina entran pendientes de revisión y las del analizador como `sin_revision`, porque ya pasan por FIRMA antes de llegar al cliente. Las lee y las revisa solo FIRMA (`ia_corrida_revisar`, `ia_resumen`), en Administración › Calidad de la IA (`components/portal/admin/CalidadIa.tsx`). Una corrida corregida se convierte en caso de prueba (`ia_casos`) con la entrada anonimizada que arma `/api/admin/ia` (migración 0075). El evaluador (`npm run ia:evaluar`, `scripts/ia/`) corre cada agente sobre sus casos de `scripts/ia/casos/`, con chequeos fijos y una rúbrica que puntúa Claude como juez y calcula el código. Gasta crédito de la API, así que corre solo a pedido, desde GitHub › Actions › Medir IA (`.github/workflows/medir-ia.yml`), una sola vez por versión: compara con la referencia guardada en `scripts/ia/referencias.json` (el último puntaje medido) y falla si baja más de 2 puntos o queda debajo del umbral. Si pasa en una rama, guarda la referencia nueva ahí. Verificar no llama a Claude: falla si un prompt cambió y su referencia no, hasta que se corra Medir IA. La batería de `docs/TINA_BATERIA.md` ya está cargada como casos en `scripts/ia/casos/tina.bateria.json`. El detalle está en `PORTAL.md`, sección Calidad de la IA. Pruebas en `supabase/pruebas/ia_corridas.sql`, `supabase/pruebas/ia_calidad.sql` y `scripts/pruebas/evaluador.mjs`.

Desde la migración 0076 la sección Equipo (`/portal/equipo`, `components/portal/equipo/`) reúne objetivos, hitos, victorias y reportes de la gente de cada empresa, sin IA. Lideran el equipo FIRMA, el titular y quien tiene el área Operaciones (`lidera_equipo()`): validan victorias, ponen objetivos, arman los reportes y bajan el Excel. Cada persona carga sus victorias con evidencia (bucket privado `equipo`) y quedan pendientes; nadie valida la propia y solo suman las validadas (`equipo_victoria_validar`). Lo que carga quien lidera para otra persona entra validado. Los reportes son por rol, diarios o semanales, y piden resultados: la base rechaza un campo de horario o de fichaje salvo que lo sume FIRMA, porque puede servir de prueba de una relación laboral. FIRMA deja plantillas de hitos y reportes por rol (sin empresa) y cada empresa las copia con `equipo_cargar_plantillas` y las ajusta. El avance de los objetivos lo calcula la base (`equipo_objetivos_avance`) desde las victorias validadas atadas al objetivo o desde un número de los reportes. El Excel con marca se arma en el navegador (`components/portal/equipo/excel.ts`): portada con el logo, una hoja por tema y fórmulas que dan lo mismo que la base. El detalle está en `PORTAL.md`, sección Equipo. Pruebas en `supabase/pruebas/equipo_objetivos_victorias.sql` y `scripts/pruebas/excel.mjs`.

Desde el 26 de noviembre de 2026 el portal usa HeroUI v3 (Apache-2.0), por ahora en Clientes. Se importa solo el CSS de los componentes que se usan (`heroui.css`) y sus colores salen de la marca («HeroUI con la marca» en `index.css`). Sus clases son globales, por eso la tarjeta de Servicios se llama `.tarjeta-servicio`; si sumás un componente de HeroUI, sumá su CSS en `heroui.css`. En computadora el menú es una barra de íconos con el nombre abajo y, al lado, el panel de la sección con sus pantallas (Clientes, Equipo y Administración), que se oculta y el navegador lo recuerda (`BarraEscritorio` y `panelDe` en `components/portal/ui.tsx`). Con el panel abierto, la navegación propia de la página se esconde con `NavegacionDePagina`. En el celular las pantallas de la sección van en una fila de chips fija debajo de la barra de arriba (`ChipsSeccion`), que reemplaza la navegación de la página, y Más abre una hoja desde abajo con las secciones en íconos (`HojaMenu`). El panel y los chips cuentan los casos en curso y las reuniones por completar (`useCuentasCrm`). En el celular la línea de tiempo deja fija la columna del nombre y arranca con hoy a la vista. El cliente abierto no lista sus hechos: cada punto (reunión, cuota o caso) muestra un cartel corto con su detalle al pasar el cursor, con el foco o con un toque. Clientes muestra de a 20 en la lista y en la línea de tiempo, con el paginador de HeroUI; la línea de tiempo pone primero los contratos vigentes, marca reuniones, cuotas y casos de cada cliente y lo abre al pasar el cursor, con los días desde el onboarding (`components/portal/crm/LineaTiempo.tsx`). Para sacar capturas sin entrar con una cuenta real está la maqueta con datos de prueba (`npm run maqueta`, `scripts/maqueta/`).

Desde el 27 de noviembre de 2026 la base compartida del portal va con HeroUI (etapa 1 de 3). Dentro de `Marco` el `Button` de `components/Button.tsx` toma las clases del botón de HeroUI sobre un `<button>` común (`DensidadBotones` en «portal» y `claseBotonHero()` para enlaces y botones hechos a mano). `claseInput` le pone a los campos nativos la clase `.input` de HeroUI y los selectores nativos llevan su flecha («Campos nativos con el estilo de HeroUI» en `index.css`). `Pestanas` son las Tabs de HeroUI con subrayado y `PestanasEnlace` las mismas cuando cada pestaña es una dirección (Documentos y Administración). `Interruptor` es el Switch, `Etiqueta` el Chip y `Aviso` el Alert. El foco de lo que es HeroUI lo marca su propio anillo, sin el contorno global. La firma y la verificación (`components/firma`), la herramienta de comprobantes y las pantallas de ingreso usan `components/uiClasica.tsx` y quedan como estaban. La etapa 2 suma `components/portal/campos.tsx`: `Selector` reemplaza al `<select>` recibiendo los mismos `<option>` y `<optgroup>` y llamando a `onChange` con `{ target: { value } }`, así el cambio es renombrar la etiqueta (con `required`, la opción vacía no cuenta como elección); `Fecha` reemplaza al `<input type="date">` o `"datetime-local"` con el DatePicker de HeroUI en español (dd/mm/aaaa y 24 horas) y devuelve el mismo texto que el nativo; `Opciones` son botones de una sola elección con ToggleButtonGroup. Las casillas y las opciones redondas siguen nativas con el aspecto de HeroUI desde `index.css`. `claseBotonHero()` suma la variante `peligro` y los botones de solo ícono. Ya pasó Clientes y la ficha (`components/portal/crm`); faltan Equipo, Asuntos con Pagos, Documentos y Firmas, y Administración, y la etapa 3 (ventanas emergentes, tablas y avisos flotantes). La maqueta abre cualquier pantalla del CRM con `?ruta=/portal/crm/...`.

En Documentos FIRMA, sin Ver como, ve los documentos de todos los clientes y los filtra por cliente (todos, la biblioteca común o una empresa) y por título o archivo, con el Select y el SearchField de HeroUI. El cliente elegido va en `?empresa=`, con el mismo valor que Administración › Documentos (`generales` para la biblioteca común), y se mantiene al cambiar de pestaña. Cada tarjeta dice de qué cliente es. Con una empresa elegida, Contratos con tu equipo muestra los contratos de su gente, solo para mirar.

Desde la migración 0078 el CRM tiene reuniones (`crm_reuniones`, `/portal/crm/reuniones` y la sección de la ficha). Cada llamada de Fathom entra sola como reunión hecha con su link y, si no había una agendada a esa hora con esa persona, queda sin tipo para que alguien la clasifique; Fathom no distingue un seguimiento de un cierre. De las reuniones salen la asistencia y el cierre de cada persona. CSM y Account Manager son lo mismo: la base guarda `account_manager` en el equipo y normaliza `csm` con un trigger; el rol del portal sigue llamándose `csm` por dentro y en pantalla dice Account Manager. En los menús de rol se usa `ROLES_ELEGIBLES`, nunca `Object.keys(ROL_COMERCIAL)`. El detalle está en `PORTAL.md`, sección Reuniones del CRM. Pruebas en `supabase/pruebas/crm_reuniones_roles.sql`.

Desde la 0079 cada servicio tiene duración en meses y Clientes tiene la vista Línea de tiempo (`crm/LineaTiempo.tsx`, con `finDelContrato`). Las fichas usan `Bloque` de `ui.tsx`: un solo título por bloque, sin volanta. Asuntos no aparece en la ficha del cliente final.

Equipo arranca en Personas: tarjetas con lo que cada uno tiene entre manos, calendario del equipo y ficha por persona (`equipo/Personas.tsx`, `CalendarioEquipo.tsx`, `FichaPersona.tsx`, lógica en `equipo/personas.ts`). Victorias pasó a `/portal/equipo/victorias`. El riesgo legal del vínculo es un puntaje orientativo que ve solo quien lidera.

Desde la 0080 cada persona conecta su Google Calendar (OAuth, permiso `calendar.events.owned`). Los tokens de actualización quedan cifrados en `google_conexiones` y solo los leen las funciones del servidor (`google_conexion_token`). Servidor en `api/google/calendario.ts`, `api/google/callback.ts` y `api/_lib/google.ts`; portal en `components/portal/google.ts`. Variables `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. El detalle está en `PORTAL.md`, sección Google Calendar.

Desde el 26 de noviembre de 2026 se publican solo los precios de lista, sin ofertas. El pago completo cubre los tres meses y el descuento se arregla en la llamada de venta. Ya no hay precio fundador, cuarto mes sin cargo ni cuota congelada; los abonos que los tienen siguen igual. En pesos se cobra al dólar cripto del día, promedio entre compra y venta, en todos los abonos (`api/_lib/cotizacion.ts`, primero dolarhoy.com y después dolarapi.com y argentinadatos.com). Las columnas siguen llamándose `al_mep` y `cotizacion_mep`.

Los abonos cobran esta oferta desde la migración 0061 (`abonos.modalidad`, `etapa`, `al_mep` y afines). Las opciones están en `OFERTAS` de `components/portal/abonos.ts` y la página pública en `components/Planes.tsx`. Si cambia un precio, se cambia en los dos. El detalle y lo que falta verificar en el sandbox de dLocal Go está en `PORTAL.md`, sección Oferta de noviembre de 2026.

**Eminent** incluye acceso directo a Agustín, Tina con derivaciones, documentos, gestión de conflictos y contacto telefónico en urgencias.

**Starter** no incluye a Tina, asesoramiento sobre casos ni redacción de documentos. Incluye perfilado de clientes, hasta 20 firmas y 10 llamadas analizadas por mes (estas últimas recién cuando el analizador esté validado), una hora semanal de consultoría general y no recibe alertas por WhatsApp. La hora adicional cuesta USD 100, más un porcentaje de éxito sobre el caso cuando corresponda.

## Tina

- **Desactivada desde el 26 de noviembre de 2026**, para no gastar en la API. La burbuja no se muestra (`TINA_ACTIVA` en `components/portal/tina/activa.ts`) y `api/tina/chat.ts` rechaza todo pedido antes de llamar a Claude (su propia `TINA_ACTIVA`). El código, el prompt, las tablas, Calidad de la IA y el evaluador quedaron como estaban; para volver a prenderla se cambian las dos llaves. Lo que sigue describe cómo se comporta cuando está prendida.
- Es la asistente con IA de FIRMA. Se presenta siempre como asistente, nunca como persona. Tiene una sola versión, femenina.
- Tono cercano, como escribiría Agustín, explicando con ejemplos sin perder rigor.
- Es solo del plan Eminent desde el 25 de noviembre de 2026. En Starter no se ve la burbuja y `api/tina/chat.ts` rechaza el pedido.
- Clasifica cada mensaje en tres caminos, accionable para el cliente, recurso precargado o derivación al responsable.
- Antes de actuar, repregunta cuando el pedido se puede resolver de forma más simple.
- El comportamiento completo está en `docs/TINA_SYSTEM_PROMPT.md` y la batería de pruebas en `docs/TINA_BATERIA.md`.

## Reglas que nunca se rompen

1. Solo `admin`, el `titular` y las áreas Legales u Operaciones generan contratos. Tina carga los datos de una venta en el CRM, después de que el usuario los confirma, y devuelve el enlace de firma solo si quien le escribe tiene ese permiso.
2. Ninguna interpretación legal sale sin revisión humana.
3. Un cliente nunca ve datos de otro cliente. Toda tabla con datos de clientes tiene RLS por `client_id`.
4. No se habilitan accesos a un servicio sin contrato firmado.
5. El resumen diario no lleva marketing.
6. Las claves de API viven solo en el servidor, nunca en el frontend.
7. No se rompe lo que ya funciona, en especial la firma electrónica con registro de auditoría.
8. A la API de Claude se envían solo los datos personales necesarios para responder.

## Canales

**Fase 1 (noviembre 2026)**
- Portal instalable como PWA, con notificaciones push. La app instalada se llama FIRMA y usa el logo de FIRMA. Hecho: avisos de asuntos, documentos, onboardings del día, firmas y derivaciones de Tina (`api/_lib/push.ts`, `components/portal/push.ts`, `public/sw.js`). Necesita `VAPID_PRIVATE_KEY` en Vercel. El proyecto de Vercel está en el plan Pro, así que no hay tope de 12 funciones y un archivo nuevo en `api/` fuera de `_lib` no necesita consulta previa.
- Centro de avisos con campana. Hecho: cada aviso que manda el servidor queda también en el historial de la persona (tabla `avisos`, migración 0066), llegue o no el push, y se guarda 90 días. Lo escribe solo el servidor desde `api/_lib/push.ts`; cada persona lee los suyos y solo puede marcarlos como leídos. La campana está en `components/portal/avisos/CentroAvisos.tsx` y las pruebas en `supabase/pruebas/avisos.sql`.
- Buscador del portal (`components/portal/Buscador.tsx`), en la barra lateral y arriba en el celular. Invoices y recibos se abre desde Clientes y la bitácora desde el pie de la barra lateral.
- Página del cliente en el CRM (`components/portal/crm/Ficha.tsx`). Al entrar muestra comprobantes, casos, asuntos y perfil, con el panel de Contratos y firma a la derecha; debajo el plan de pagos y al final el historial. La ficha de datos queda oculta y se abre con «Editar datos»; al guardar, la persona se queda en el cliente.
- Burbuja de chat de Tina dentro del portal. Hecha y apagada desde el 26 de noviembre de 2026.
- Resumen diario por mail a las 7 de la mañana de Argentina para todos los clientes, de lunes a viernes, aparte de las alertas de vencimientos y de la newsletter de los lunes, al titular y a los account managers. Si no hay novedades, se manda un mensaje corto que lo avisa. Usa el mismo servicio de mail que la firma electrónica.
- Notificaciones solo operativas. Los onboardings le avisan al account manager. En asuntos y conflictos, quien actualiza el portal marca una opción para que Tina avise al responsable.
- Los datos del resumen salen del portal. Las migraciones desde el CRM de cada cliente las hace `admin` por CSV.

**Desde enero 2027.** Invoices, Tina por WhatsApp, audios con ElevenLabs, auditoría de llamadas, integración con Go High Level, vencimientos y contracargos, firma electrónica propia con sello de tiempo.

## Landing de campañas

`/landing` es el home resumido para campañas (`App.tsx`): arriba de todo y fijo el banner «50% OFF Black Friday en el plan Eminent» (`PromoBanner fijo`; el home muestra el mismo banner, sin fijar), el hero con el contador y el logo a la derecha de la firma de Agustín debajo del video (`conLogo` en `components/VideoVSL.tsx`), que lleva a `/`, clientes, cómo ayudamos y la agenda. El video del hero va sin la barra del reproductor y sin pausa una vez activado el sonido, en el home y en la landing (`components/VideoVSL.tsx`). No lleva Servicios ni la carta, usa menos aire entre secciones (`.landing-corta` en `index.css`) y va con `noindex` en `vercel.json`. Comparte los componentes del home, así que un cambio en ellos se ve en las dos.

## Estilo visual

Portal y mails a clientes en negro. Web pública y PDF firmado en verde.

## Marco legal

Ley argentina y tribunales ordinarios de la Ciudad de Buenos Aires. Tina no presta asesoramiento legal y sus respuestas son orientativas. La responsabilidad de FIRMA se limita a lo abonado en los últimos tres meses.

## Forma de trabajar

- Antes de codear, resumí el plan y preguntá lo que falte.
- Cambios chicos y verificables. Migraciones de Supabase versionadas.
- Interfaz en español rioplatense, con voseo.
- Al terminar cada tarea, resumí qué cambió para actualizar este archivo.
