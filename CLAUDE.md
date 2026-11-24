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
| Eminent | USD 750 por mes | USD 1800 | USD 500 por mes, o bajar a Starter |
| Starter | USD 400 por mes | USD 1000 | USD 250 por mes |

En el código (`organizaciones.plan`) los planes de servicio son `starter` y `eminent` desde la migración 0059, que retiró Gold y Black. Starter trae 60 minutos de agenda por semana y 20 firmas por mes. Hoy todos los clientes son Eminent.

Las tablas de Tina están en la migración 0060 (`tina_conversaciones`, `tina_mensajes`, `tina_tickets`, `eventos_cliente`, `push_suscripciones`, las columnas `tina_*` de `documentos` y `organizaciones.responsable_id`). Sus pruebas están en `supabase/pruebas/tina.sql`.

El chat de Tina es `POST /api/tina/chat` (`api/tina/chat.ts`), con las herramientas en `api/_lib/tina/herramientas.ts`, el prompt armado desde `docs/TINA_SYSTEM_PROMPT.md` (`api/_lib/tina/prompt.ts`) y los precios en `api/_lib/tina/precios.ts`. Usa `claude-opus-5-5` con esfuerzo bajo y necesita `ANTHROPIC_API_KEY` en Vercel. Si se cambia el documento del prompt, se cambia lo que dice Tina.

El análisis de llamadas de venta está en la migración 0067 (`analisis_codigos`, `interaccion_analisis`). Corre en la cola (`interaccion_analizar` en `api/_lib/cola.ts`, con `api/_lib/analisis/`): `claude-haiku-5-5` clasifica la etapa y `claude-opus-5-5` codifica las de venta con `docs/ANALIZADOR_VENTA.md`, que sale de la skill perfil-riesgo-prospecto v1.1. El puntaje lo calcula la base (`analisis_puntuar`), nunca el modelo, y FIRMA aprueba cada análisis antes de que lo vea el negocio. Si se cambia el documento o un peso, se publica una versión nueva del libro de códigos. El detalle está en `PORTAL.md`, sección Análisis de llamadas de venta.

Los contratos con el equipo están en la migración 0068. Un documento de Contratos con tu equipo o un envío a firma se ata a una persona activa del equipo y lleva el vencimiento del contrato (`contrato_vence_el`), y la tarjeta muestra nombre completo, rol y vencimiento (`components/portal/firmas/ContratosEquipo.tsx`). Los ven solo `admin`, el `titular` y las áreas Legales u Operaciones. Los formularios de pedido de contrato propios de una empresa se arman sin código en Administración › Formularios (`modelos_contrato`, `components/portal/admin/Formularios.tsx`, `components/portal/pedidos/propio.ts`); closer y setter siguen escritos en el código. Al cargar un documento en Administración › Documentos, «¿Es su contrato modelo?» también ofrece los formularios propios de la empresa y «Sí, de otro rol», que crea el formulario con ese nombre y los datos de la persona y le ata el documento (`modelos_contrato.documento_id`). El detalle está en `PORTAL.md`, sección Pedidos de contrato. Pruebas en `supabase/pruebas/contratos_equipo_y_modelos.sql`.

La gente del equipo que no es closer, setter, account manager ni CSM lleva su rol escrito a mano desde la migración 0069 (`equipo_miembros.cargo`, cuarto argumento opcional de `equipo_sumar`). El rol se muestra siempre con `rolDe()` de `components/portal/crm/tipos.ts`. En Administración, Documentos ordena por `actualizado_en` con lo más nuevo arriba (`documentos.orden` quedó en la base sin uso), se filtra por empresa y tiene buscador; Usuarios y Documentos se abren filtrados con `?empresa=<id>`, que es como se llega desde cada fila de Clientes. Un usuario se elimina con la acción `eliminar` de `/api/admin/usuarios`, que pide su mail como confirmación, borra la cuenta y conserva lo que hizo.

Los comentarios de clientes en documentos de un asunto (migración 0065) se exportan desde el visor, solo FIRMA, con «Copiar todos» y «Descargar en Word» (`components/portal/comentarios/exportar.ts`). Desde la migración 0070, de lunes a viernes Tina deja un borrador de respuesta por cada hilo de cliente sin contestar (`comentario_borradores`, `api/_lib/tina/borradores.ts`, trabajos `comentarios_borrador` y `comentarios_brief` de la cola, encolados por la tarea diaria de `api/portal/resumen.ts`) y le avisa a FIRMA por mail y por la campana. FIRMA lo corrige y lo publica o lo descarta en el visor; el cliente no ve nada antes. El detalle está en `PORTAL.md`, sección Comentarios de documentos. Pruebas en `supabase/pruebas/borradores_comentarios.sql`.

Desde la migración 0071, FIRMA edita los Word de un asunto dentro del visor (`components/portal/editor/`): cada párrafo se escribe encima y el motor (`wordXml.ts`) cambia solo el texto dentro del archivo, sin tocar el formato. Lo guardado es un borrador que el cliente no ve; al publicar pasa a ser la versión vigente (`asunto_archivos.ruta`) y las anteriores quedan en `asunto_archivo_versiones`. Solo `admin` y solo `.docx`. El detalle está en `PORTAL.md`, sección Editar los Word de un asunto. Pruebas en `supabase/pruebas/versiones_documentos.sql` y `scripts/pruebas/wordXml.mjs`.

El pago completo suma el cuarto mes sin cargo y la cuota congelada por 12 meses. Precio fundador, para los primeros 5 clientes o hasta el 31/12/2026, es Eminent USD 1500 y Starter USD 800, solo con pago completo. En pesos se cobra al equivalente del dólar MEP.

Los abonos cobran esta oferta desde la migración 0061 (`abonos.modalidad`, `etapa`, `al_mep` y afines). Las opciones están en `OFERTAS` de `components/portal/abonos.ts` y la página pública en `components/Planes.tsx`. Si cambia un precio, se cambia en los dos. El detalle y lo que falta verificar en el sandbox de dLocal Go está en `PORTAL.md`, sección Oferta de noviembre de 2026.

**Eminent** incluye acceso directo a Agustín, Tina completa con derivaciones, documentos, gestión de conflictos y contacto telefónico en urgencias.

**Starter** no incluye asesoramiento sobre casos ni redacción de documentos. Incluye perfilado de clientes, Tina limitada sin derivaciones, hasta 20 firmas y 10 llamadas analizadas por mes (estas últimas recién cuando el analizador esté validado), una hora semanal de consultoría general y no recibe alertas por WhatsApp. La hora adicional cuesta USD 100, más un porcentaje de éxito sobre el caso cuando corresponda.

## Tina

- Es la asistente con IA de FIRMA. Se presenta siempre como asistente, nunca como persona. Tiene una sola versión, femenina.
- Tono cercano, como escribiría Agustín, explicando con ejemplos sin perder rigor.
- Clasifica cada mensaje en tres caminos, accionable para el cliente, recurso precargado o derivación al responsable. La derivación existe solo en Eminent.
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
- Portal instalable como PWA, con notificaciones push. La app instalada se llama FIRMA y usa el logo de FIRMA. Hecho: avisos de asuntos, documentos, onboardings del día, firmas y derivaciones de Tina (`api/_lib/push.ts`, `components/portal/push.ts`, `public/sw.js`). Necesita `VAPID_PRIVATE_KEY` en Vercel. Vercel tiene 12 funciones, que era el tope del plan Hobby: antes de sumar un archivo nuevo en `api/` fuera de `_lib`, confirmar el límite vigente.
- Centro de avisos con campana. Hecho: cada aviso que manda el servidor queda también en el historial de la persona (tabla `avisos`, migración 0066), llegue o no el push, y se guarda 90 días. Lo escribe solo el servidor desde `api/_lib/push.ts`; cada persona lee los suyos y solo puede marcarlos como leídos. La campana está en `components/portal/avisos/CentroAvisos.tsx` y las pruebas en `supabase/pruebas/avisos.sql`.
- Buscador del portal (`components/portal/Buscador.tsx`), en la barra lateral y arriba en el celular. Invoices y recibos se abre desde Clientes y la bitácora desde el pie de la barra lateral.
- Página del cliente en el CRM (`components/portal/crm/Ficha.tsx`). Al entrar muestra comprobantes, casos, asuntos y perfil, con el panel de Contratos y firma a la derecha; debajo el plan de pagos y al final el historial. La ficha de datos queda oculta y se abre con «Editar datos»; al guardar, la persona se queda en el cliente.
- Burbuja de chat de Tina dentro del portal.
- Resumen diario por mail a las 7 de la mañana de Argentina para todos los clientes, de lunes a viernes, aparte de las alertas de vencimientos y de la newsletter de los lunes, al titular y a los account managers. Si no hay novedades, se manda un mensaje corto que lo avisa. Usa el mismo servicio de mail que la firma electrónica.
- Notificaciones solo operativas. Los onboardings le avisan al account manager. En asuntos y conflictos, quien actualiza el portal marca una opción para que Tina avise al responsable.
- Los datos del resumen salen del portal. Las migraciones desde el CRM de cada cliente las hace `admin` por CSV.

**Desde enero 2027.** Invoices, Tina por WhatsApp, audios con ElevenLabs, auditoría de llamadas, integración con Go High Level, vencimientos y contracargos, firma electrónica propia con sello de tiempo.

## Landing de campañas

`/landing` es el home resumido para campañas (`App.tsx`): encabezado con el logo solo, que lleva a `/`, el banner del descuento, el hero con el contador, clientes, cómo ayudamos y la agenda. No lleva Servicios ni la carta, usa menos aire entre secciones (`.landing-corta` en `index.css`) y va con `noindex` en `vercel.json`. Comparte los componentes del home, así que un cambio en ellos se ve en las dos.

## Estilo visual

Portal y mails a clientes en negro. Web pública y PDF firmado en verde.

## Marco legal

Ley argentina y tribunales ordinarios de la Ciudad de Buenos Aires. Tina no presta asesoramiento legal y sus respuestas son orientativas. La responsabilidad de FIRMA se limita a lo abonado en los últimos tres meses.

## Forma de trabajar

- Antes de codear, resumí el plan y preguntá lo que falte.
- Cambios chicos y verificables. Migraciones de Supabase versionadas.
- Interfaz en español rioplatense, con voseo.
- Al terminar cada tarea, resumí qué cambió para actualizar este archivo.
