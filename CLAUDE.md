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

En el código el cliente de FIRMA es `organizaciones` y `client_id` es `organizacion_id`. El glosario completo y el estado del repo están en `docs/ESTADO_ACTUAL.md`.

## Planes

| Plan | Tres cuotas | Pago completo | Después de los tres meses |
| --- | --- | --- | --- |
| Eminent | USD 750 por mes | USD 1800 | USD 500 por mes, o bajar a Starter |
| Starter | USD 400 por mes | USD 1000 | USD 250 por mes |

En el código (`organizaciones.plan`) los planes de servicio son `starter` y `eminent` desde la migración 0059, que retiró Gold y Black. Starter trae 60 minutos de agenda por semana y 20 firmas por mes. Hoy todos los clientes son Eminent.

Las tablas de Tina están en la migración 0060 (`tina_conversaciones`, `tina_mensajes`, `tina_tickets`, `eventos_cliente`, `push_suscripciones`, las columnas `tina_*` de `documentos` y `organizaciones.responsable_id`). Sus pruebas están en `supabase/pruebas/tina.sql`.

El chat de Tina es `POST /api/tina/chat` (`api/tina/chat.ts`), con las herramientas en `api/_lib/tina/herramientas.ts`, el prompt armado desde `docs/TINA_SYSTEM_PROMPT.md` (`api/_lib/tina/prompt.ts`) y los precios en `api/_lib/tina/precios.ts`. Usa `claude-opus-5-5` con esfuerzo bajo y necesita `ANTHROPIC_API_KEY` en Vercel. Si se cambia el documento del prompt, se cambia lo que dice Tina.

El pago completo suma el cuarto mes sin cargo y la cuota congelada por 12 meses. Precio fundador, para los primeros 5 clientes o hasta el 31/12/2026, es Eminent USD 1500 y Starter USD 800, solo con pago completo. En pesos se cobra al equivalente del dólar MEP.

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
- Portal instalable como PWA, con notificaciones push. La app instalada se llama FIRMA y usa el logo de FIRMA.
- Burbuja de chat de Tina dentro del portal.
- Resumen diario por mail a las 7 de la mañana de Argentina para todos los clientes, de lunes a viernes, aparte de las alertas de vencimientos y de la newsletter de los lunes, al titular y a los account managers. Si no hay novedades, se manda un mensaje corto que lo avisa. Usa el mismo servicio de mail que la firma electrónica.
- Notificaciones solo operativas. Los onboardings le avisan al account manager. En asuntos y conflictos, quien actualiza el portal marca una opción para que Tina avise al responsable.
- Los datos del resumen salen del portal. Las migraciones desde el CRM de cada cliente las hace `admin` por CSV.

**Desde enero 2027.** Invoices, Tina por WhatsApp, audios con ElevenLabs, auditoría de llamadas, integración con Go High Level, vencimientos y contracargos, firma electrónica propia con sello de tiempo.

## Estilo visual

Portal y mails a clientes en negro. Web pública y PDF firmado en verde.

## Marco legal

Ley argentina y tribunales ordinarios de la Ciudad de Buenos Aires. Tina no presta asesoramiento legal y sus respuestas son orientativas. La responsabilidad de FIRMA se limita a lo abonado en los últimos tres meses.

## Forma de trabajar

- Antes de codear, resumí el plan y preguntá lo que falte.
- Cambios chicos y verificables. Migraciones de Supabase versionadas.
- Interfaz en español rioplatense, con voseo.
- Al terminar cada tarea, resumí qué cambió para actualizar este archivo.
