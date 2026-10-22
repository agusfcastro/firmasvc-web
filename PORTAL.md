# Portal de clientes FIRMA · Puesta en marcha del módulo 1

Accesos, roles, panel de administración y registro de ingresos. Se hace una sola vez y lleva unos 30 minutos.

## 1. Crear el proyecto en Supabase

1. Entrá a supabase.com con agustin@firmasvc.com y creá un proyecto llamado `firma-portal`. Región São Paulo (sa-east-1), la más cercana.
2. Guardá la contraseña de la base en tu gestor de contraseñas. No la vas a usar a diario.

## 2. Crear las tablas y los permisos

1. En Supabase abrí **SQL Editor › New query**.
2. Pegá todo el contenido de `supabase/migraciones/0001_portal_accesos.sql` y apretá **Run**.

## 3. Configurar el login

En **Authentication › Sign In / Providers**

1. Desactivá **Allow new users to sign up**. El acceso es solo por invitación.
2. Dejá activo **Email**. Activá **Secure password change**.
3. En **Authentication › Policies** (o Password settings) poné mínimo 10 caracteres con letras y números.

En **Authentication › URL Configuration**

1. Site URL `https://firmasvc.com`
2. Redirect URLs agregá `https://www.firmasvc.com/portal/clave`, `https://firmasvc.com/portal/clave` y `http://localhost:3000/portal/clave`

## 4. Mails con la marca de FIRMA

Los mails del portal y de la firma electrónica salen por Resend con una sola plantilla, la de `api/_lib/mail.ts`. Lleva el logo, los colores de la marca, el botón en verde bosque y el pie con tu firma. El logo se carga desde `https://www.firmasvc.com/mail/firma-lockup.png`.

**Qué sale por dónde**

| Mail | Sale por | Plantilla |
|---|---|---|
| Invitación al portal | Resend, desde `api/admin/usuarios.ts` | La de FIRMA, automática |
| Reenviar acceso, desde Usuarios | Resend, desde `api/admin/usuarios.ts` | La de FIRMA, automática |
| Firma electrónica: invitación, código, recordatorio, firmado y anulado | Resend, desde `api/firma` | La de FIRMA, automática |
| «Olvidé mi contraseña», desde la pantalla de ingreso | Resend, desde `api/portal/recuperar.ts` | La de FIRMA, automática |
| Avisos de asuntos y documentos nuevos | Resend, desde `api/portal/avisos.ts` | La de FIRMA, automática |

**1. Resend**

1. En resend.com verificá el dominio `firmasvc.com` y creá una API key con permiso de envío.
2. En Vercel cargá `RESEND_API_KEY`. Opcionales: `PORTAL_MAIL_DIRECCION` (remitente de las invitaciones, por defecto `portal@firmasvc.com`) y `FIRMA_MAIL_DIRECCION` (remitente de la firma electrónica, por defecto `firmas@firmasvc.com`).

Sin `RESEND_API_KEY`, las invitaciones vuelven a salir por el servidor de Supabase, sin la marca. Si Resend rechaza un mail, la cuenta se crea igual y el panel muestra el enlace para mandarlo por WhatsApp.

**2. Supabase, solo como respaldo**

Con `RESEND_API_KEY` cargada, Supabase no manda ningún mail del portal. Solo los manda si falta esa variable o si la función de Vercel no responde. El servidor de mails que trae Supabase manda muy pocos por hora y suele caer en spam; si querés tener el respaldo con la marca, en **Authentication › Emails › SMTP Settings** cargá el de Resend:

| Campo | Valor |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la API key de Resend |
| Sender email | `portal@firmasvc.com` |
| Sender name | `FIRMA` |

Después, en **Authentication › Emails › Templates › Reset password**, poné el asunto `Definí tu contraseña del portal de FIRMA` y pegá este HTML:

```html
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600&family=Bitter:wght@700;900&display=swap" rel="stylesheet">
<title>Definí tu contraseña</title></head>
<body style="margin:0;padding:0;background:#F5F3EC">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Enlace para definir tu contraseña.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F3EC"><tr><td align="center" style="padding:36px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px">
<tr><td style="padding:0 4px 24px">
<img src="https://www.firmasvc.com/mail/firma-lockup.png" width="200" height="45" alt="firma · Castro &amp; Partners Legal Consulting" style="display:block;border:0;width:200px;height:auto;font-family:'Bitter', Georgia, 'Times New Roman', serif;font-size:24px;font-weight:900;color:#1B1F1B">
</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #DEDBD0;border-top:3px solid #173A2F;padding:36px 32px">
<p style="margin:0 0 14px;font-family:'Archivo', Arial, Helvetica, sans-serif;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#6B6553">Portal de clientes</p>
<h1 style="margin:0 0 22px;font-family:'Bitter', Georgia, 'Times New Roman', serif;font-size:26px;font-weight:900;line-height:1.2;letter-spacing:-.01em;color:#1B1F1B">Definí tu contraseña</h1>
<p style="margin:0 0 16px;font-family:'Archivo', Arial, Helvetica, sans-serif;font-size:15px;line-height:1.65;color:#1B1F1B">Hola.</p><p style="margin:0 0 16px;font-family:'Archivo', Arial, Helvetica, sans-serif;font-size:15px;line-height:1.65;color:#1B1F1B">Recibimos un pedido para definir la contraseña de tu cuenta en el portal de clientes de FIRMA.</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 12px"><tr><td style="background:#173A2F">
<a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:15px 28px;font-family:'Archivo', Arial, Helvetica, sans-serif;font-size:15px;font-weight:600;color:#F5F3EC;text-decoration:none">Definir mi contraseña &rarr;</a>
</td></tr></table>
<p style="margin:0 0 8px;font-family:'Archivo', Arial, Helvetica, sans-serif;font-size:12px;line-height:1.5;color:#6B6553">Si el botón no funciona, copiá este enlace en el navegador:<br><a href="{{ .ConfirmationURL }}" style="color:#173A2F;word-break:break-all">{{ .ConfirmationURL }}</a></p><p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #DEDBD0;font-family:'Archivo', Arial, Helvetica, sans-serif;font-size:12px;line-height:1.55;color:#6B6553">Si no lo pediste vos, ignorá este mail. Tu contraseña actual sigue igual.</p>
</td></tr>
<tr><td style="background:#2B2B2B;padding:22px 32px">
<p style="margin:0 0 4px;font-family:'Archivo', Arial, Helvetica, sans-serif;font-size:13px;font-weight:600;color:#F5F3EC">Agustín Castro · Abogado (UBA)</p>
<p style="margin:0;font-family:'Archivo', Arial, Helvetica, sans-serif;font-size:12px;line-height:1.6;color:#A9A79E">FIRMA · Castro &amp; Partners Legal Consulting · <a href="https://www.firmasvc.com" style="color:#A9A79E;text-decoration:underline">firmasvc.com</a><br>Información confidencial, alcanzada por el secreto profesional.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>
```

La plantilla **Invite user** de Supabase solo se usa si falta `RESEND_API_KEY`.

## 5. Crear tu usuario admin

1. **Authentication › Users › Add user › Create new user** con agustin@firmasvc.com y una contraseña fuerte. Marcá **Auto Confirm User**.
2. En **SQL Editor** ejecutá `supabase/primer_admin.sql`.

## 6. Variables en Vercel

En **Project Settings › API** de Supabase copiá la URL, la clave `anon` y la clave `service_role`. Después, en Vercel, **Settings › Environment Variables** cargá estas cinco para Production y Preview.

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto |
| `VITE_SUPABASE_ANON_KEY` | clave anon |
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | clave service_role |
| `PORTAL_URL` | `https://www.firmasvc.com`, con www |

**La clave service_role da control total sobre la base. Nunca la pongas con prefijo VITE_, ni en el código, ni en un chat.**

Después hacé un redeploy. Para probar en tu compu copiá `.env.example` como `.env.local` y completalo.

## 7. Uso diario

Entrá a `firmasvc.com/portal`.

1. **Clientes** para dar de alta cada empresa, con su logo.
2. **Usuarios › Invitar usuario** con mail, nombre, rol, cliente y áreas. A la persona le llega el mail y define su contraseña. Si el mail no sale, la cuenta se crea igual y el panel muestra el enlace de acceso para copiarlo y mandarlo por WhatsApp. Si marcás **No mandar mail**, va directo al enlace.
3. Para cortar el acceso de alguien usá **Desactivar**. Queda bloqueado de inmediato y su historial se conserva.
4. Si alguien perdió el mail o la contraseña, **Reenviar acceso** se lo manda por mail y **Copiar enlace** te lo da para mandarlo vos. Cada enlace vence en 24 horas y se usa una sola vez.
5. **Registro de accesos** muestra quién ingresó y quién cambió permisos.

### Roles

| Rol | Qué ve |
|---|---|
| Admin FIRMA | Todo, de todos los clientes, y el panel de administración |
| Titular | Todo lo de su empresa, incluida la administración: equipo, pagos y servicios |
| CSM | Todo menos la administración de la empresa. Si le marcás áreas, los documentos se limitan a esas |
| Closer | CRM y agenda, sin casos de conflicto. De documentos, solo protocolos y formación |
| Setter | Solo protocolos y formación |

Las cuentas viejas con rol Miembro del equipo funcionan como CSM. Para que rijan estos roles corré `supabase/migraciones/0012_roles_equipo.sql` en **SQL Editor**. Un documento cuenta como protocolo o formación cuando tiene marcada esa casilla en **Administración › Documentos**; la migración la marca sola en los protocolos que ya estaban.

Los permisos los aplica la base de datos. Aunque alguien manipule la página, un cliente no puede leer datos de otro.

## Archivos del módulo

| Archivo | Para qué |
|---|---|
| `supabase/migraciones/0001_portal_accesos.sql` | Tablas, roles y permisos |
| `supabase/primer_admin.sql` | Alta de tu usuario admin |
| `api/admin/usuarios.ts` | Invitar, editar, activar y desactivar (servidor) |
| `components/portal/` | Pantallas del portal y del panel |
| `vercel.json` | Excluye `/api` del rewrite y marca `/portal` como no indexable |

## Módulo Documentos

Contratos de servicio, contratos con el equipo y otros documentos, en `firmasvc.com/portal/documentos`.

### Puesta en marcha

1. En Supabase abrí **SQL Editor › New query**, pegá todo `supabase/migraciones/0005_documentos.sql` y apretá **Run**. Crea la tabla, los permisos y el espacio privado para los archivos.
2. En **Storage** fijate que aparezca el bucket `documentos` como privado. No lo hagas público.

### Uso

1. **Administración › Documentos › Nuevo documento**.
2. Elegí la sección, para quién es (todos los clientes o uno solo) y subí el archivo o pegá el enlace.
3. **Quién lo ve dentro de la empresa** limita el documento a ciertas áreas. Sin áreas lo ve todo el equipo y el titular ve todo siempre. Los contratos con el equipo arrancan reservados a Dirección.
4. Para actualizar un modelo editalo, subí el archivo nuevo y cambiá la versión. El cliente ve la fecha de actualización y el archivo anterior se borra.
5. **Visible en el portal** apagado lo saca de la vista del cliente sin borrarlo.

Cada descarga de un cliente queda en **Registro de accesos**. Formatos admitidos Word, PDF, Excel, PowerPoint, ODT y RTF, hasta 25 MB. Los archivos se bajan con enlaces que vencen en un minuto.

| Archivo | Para qué |
|---|---|
| `supabase/migraciones/0005_documentos.sql` | Tabla, permisos, bucket privado y registro de descargas |
| `components/portal/Documentos.tsx` | Vista del cliente con las tres secciones |
| `components/portal/admin/Documentos.tsx` | Carga, reemplazo y visibilidad desde Administración |
| `components/portal/descargas.ts` | Secciones, formatos y descargas |

## CRM con contratos en ZapSign

**En pausa.** El alta ya no genera el contrato en ZapSign: ahora arma un borrador en Drive (ver *Borradores de contrato con Claude*) y el envío a firmar se hace a mano. La generación en ZapSign sigue disponible desde la ficha para las empresas que lo tengan conectado.

Al dar de alta un cliente en el CRM se generaba su contrato en ZapSign con el modelo del servicio. El link de firma queda en la ficha y en el listado, con un botón para copiarlo. Cuando el cliente firma, ZapSign avisa y el estado pasa a Firmado.

### Puesta en marcha

1. En Supabase corré `supabase/migraciones/0006_crm_zapsign.sql` en **SQL Editor**.
2. No hacen falta variables nuevas en Vercel. El aviso de firma usa una clave que arma el servidor con `SUPABASE_SERVICE_ROLE_KEY` y la dirección de `PORTAL_URL`. Si algún día cambiás la clave service role, volvé a conectar ZapSign en cada empresa.

### Por empresa

1. En ZapSign, dentro de la organización del cliente, creá el modelo DOCX con las variables que lista **Administración › ZapSign**.
2. En **Administración › ZapSign** elegí la empresa, pegá el token de la API de esa organización (Configuración › Integración) y apretá **Conectar**. El portal valida el token y registra solo el aviso de firma.
3. Elegí el modelo por defecto y, si hace falta, uno distinto por servicio.

### Reglas

- Anticipo más cuotas tiene que sumar exacto el monto acordado. Si no cierra, el alta no se guarda.
- Si el contrato no se pudo generar, cualquier usuario de la empresa lo reintenta desde la ficha. Generar uno nuevo cuando ya hay link lo hace solo FIRMA.
- ZapSign no le manda mails al cliente. El link lo envía el equipo.
- El token nunca llega al navegador. Vive en la tabla `zapsign_cuentas`, que solo lee el servidor.

| Archivo | Para qué |
|---|---|
| `supabase/migraciones/0006_crm_zapsign.sql` | Columnas del contrato, tokens privados y vista con próxima cuota y 30 días |
| `api/crm/contrato.ts` | Genera el contrato en ZapSign y guarda el link |
| `api/zapsign/webhook.ts` | Recibe el aviso de firma y pasa el cliente a Firmado |
| `api/admin/zapsign.ts` | Conecta y desconecta cada empresa y lista sus modelos |
| `components/portal/admin/ZapSign.tsx` | Pestaña de Administración con conexión, modelos, servicios y variables |

## Firma electrónica propia

Sistema de firma propio, sin ZapSign ni otro proveedor. Desde `firmasvc.com/portal/firmas` se sube un PDF, se cargan los firmantes y cada uno firma desde el mail. Al final todos reciben el PDF firmado, con una constancia de firma al final y el código de verificación en el pie de cada hoja.

Lo usan FIRMA, los titulares y los CSM. El titular ve todos los envíos de su empresa. El CSM, los que mandó él. Closer y setter no ven la sección.

### Cómo funciona

1. Quien envía sube el PDF, le pone título, plazo (3 a 90 días) y firmantes. Puede elegir que firmen en orden. FIRMA puede mandar a nombre propio o de un cliente.
2. El servidor valida el PDF, calcula su SHA-256 y lo guarda en el bucket privado `firmas`. A partir de ahí no se toca.
3. Cada firmante recibe un mail con su enlace personal (`/firmar/...`). El enlace es un sello HMAC y no se guarda en la base. Todo pasa en la web, como en ZapSign: el documento se ve hoja por hoja dentro de la página (pdf.js), sin abrirlo en el visor del navegador ni descargarlo, y se firma desde una barra fija abajo. Solo cuando firmaron todos aparece el botón para guardar una copia del PDF firmado.
4. Para firmar pide un código de 6 números que le llega al mail. Vence en 10 minutos, admite 5 intentos y como mucho 8 envíos. Validado, tiene media hora para firmar.
5. Firma dibujando o escribiendo su nombre, completa su documento si se lo piden y acepta el texto de consentimiento. Se guardan la imagen y su hash, la IP, el dispositivo y la hora.
6. Cuando firman todos, el servidor arma el PDF final: el original intacto, el pie con el código en cada hoja y la constancia con los datos del envío, cada firmante con su firma y el registro completo de eventos. Calcula su SHA-256 y lo manda adjunto a todos.
7. Cualquiera verifica un documento en `firmasvc.com/verificar`, subiendo el PDF (el hash se calcula en el navegador) o con el código.

Si alguien rechaza, el envío se cierra y avisa a quien lo mandó. Quien envía puede anular, reenviar el mail, copiar los enlaces para mandarlos por WhatsApp y descargar el original o el firmado.

### Registro de eventos

Cada paso queda en `firma_eventos`: creación, mails, aperturas, códigos pedidos, validados y fallidos, firmas, rechazos, anulaciones, descargas y el armado del PDF. Cada evento guarda el hash del anterior del mismo envío y la base no deja editarlos ni borrarlos. La ficha del envío y la página de verificación recalculan la cadena y avisan si no cierra.

### Puesta en marcha

1. En Supabase corré `supabase/migraciones/0010_firma_electronica.sql` en **SQL Editor**. Crea las tablas, el registro encadenado y el bucket privado `firmas`.
2. En Resend verificá el dominio `firmasvc.com` (si ya lo usás para los mails del portal, está hecho) y creá una API key con permiso de envío.
3. En Vercel sumá estas variables y volvé a desplegar.

| Variable | Valor |
|---|---|
| `RESEND_API_KEY` | La API key de Resend. Sin ella el envío se crea igual, pero nadie puede pedir el código para firmar |
| `FIRMA_MAIL_DIRECCION` | Opcional. Remitente de los mails, por defecto `firmas@firmasvc.com` |
| `FIRMA_CLAVE_FIRMAS` | Opcional pero recomendada. Una clave larga al azar para los enlaces y los códigos (`openssl rand -hex 32`). Si falta se deriva de la service role. Cambiarla invalida los enlaces que estén en curso |
| `CRON_SECRET` | Una clave larga al azar. Vercel la manda sola a la tarea diaria |

4. La tarea diaria ya está en `vercel.json` (todos los días a las 10, hora de Buenos Aires). Vence los envíos con el plazo cumplido, manda un recordatorio a quien no firmó cada tres días y reintenta los PDF firmados que no se pudieron armar.

### Reglas

- Solo PDF, hasta 15 MB, sin contraseña. Hasta 20 firmantes por envío, cada uno con su propio mail.
- El PDF original no cambia nunca. El final se arma sobre una copia y antes se comprueba el hash del original y de cada firma.
- Un envío firmado por todos no vence aunque el armado del PDF falle. FIRMA lo reintenta desde la ficha o lo hace la tarea diaria.
- Los códigos se guardan solo como hash y nunca llegan al navegador. Tampoco la versión del enlace.
- Recordatorios a mano, como mucho uno cada media hora por firmante.
- Hoy la firma va en la constancia del final, no en una posición dentro del documento.

| Archivo | Para qué |
|---|---|
| `supabase/migraciones/0010_firma_electronica.sql` | Envíos, firmantes, registro encadenado, permisos y bucket |
| `api/firma/sobres.ts` | Crear, enlaces, recordar, anular y descargar, con la sesión del portal |
| `api/firma/firmar.ts` | Lado del firmante, armado del PDF, verificación pública y tarea diaria |
| `components/portal/firmas/` | Sección Firma electrónica del portal |
| `components/firma/FirmarApp.tsx` | Página pública para firmar |
| `components/firma/Verificar.tsx` | Página pública de verificación |

## Casos de conflicto

Registro de reclamos y pedidos de reembolso de cada cliente final, en `firmasvc.com/portal/crm/casos`. Con esos casos el CRM calcula los indicadores del tablero del protocolo de conflictos (`/protocolo-conflictos`).

### Puesta en marcha

1. En Supabase corré `supabase/migraciones/0007_crm_casos.sql` en **SQL Editor**. Crea la tabla `crm_casos` con sus reglas, su historial y sus permisos. Se puede correr más de una vez.
2. No hacen falta variables nuevas.

### Uso

1. En el listado del CRM, **Casos de conflicto** abre el tablero del mes y el registro. El número rojo del botón son los casos en curso.
2. **Nuevo caso** abre el formulario. En la ficha de cada cliente, **Abrir un caso** lo abre con ese cliente elegido, y debajo del plan de pagos se listan sus casos.
3. Cada caso lleva apertura, causa, canal, monto reclamado, etapa, semáforo de la compuerta legal, derivación a legales y contracargo. Para cerrarlo se pasa a la etapa Cerrado con la decisión, la fecha de cierre y el monto concedido.
4. **Período** elige el mes, entre el actual y los once anteriores. La tabla muestra los casos que estuvieron abiertos en algún momento de ese mes.

### Indicadores

| Indicador | Cálculo |
|---|---|
| Abiertos hoy | Casos en curso, sin importar el mes elegido |
| Reclamos cada 100 ventas | Casos abiertos en el mes sobre clientes dados de alta en el mes en el CRM, por cien |
| Resueltos antes de legales | Cerrados en el mes sin derivación sobre cerrados en el mes |
| Tiempo medio de resolución | Días entre apertura y cierre de los cerrados en el mes |
| Costo de concesiones | Monto concedido en los cerrados en el mes sobre el monto total de las altas del mes. Con más de una moneda se calcula por moneda, sin convertir |
| Contracargos | Casos abiertos en el mes con contracargo y porcentaje ganado sobre los recibidos |
| Causas raíz | Casos abiertos en el mes por causa, de mayor a menor |

### Reglas

1. La empresa ve, carga y edita sus casos. Borran solo el titular y FIRMA. Nadie ve casos de otra empresa.
2. La organización del caso es siempre la del cliente y los montos van en la moneda del cliente.
3. Un caso cerrado tiene decisión y fecha de cierre, que no puede ser anterior a la apertura. Uno abierto no lleva fecha de cierre. El resultado del contracargo solo se carga si hubo contracargo.
4. Un caso en legales o en difusión pública queda marcado como derivado a legales.
5. Cada alta, cambio o baja de un caso queda en el historial de la ficha del cliente.

| Archivo | Para qué |
|---|---|
| `supabase/migraciones/0007_crm_casos.sql` | Tabla de casos, reglas de coherencia, historial y permisos |
| `components/portal/crm/Casos.tsx` | Tablero, registro y formulario, más la sección de casos de la ficha |
| `components/portal/crm/reglasCasos.ts` | Tipos, rótulos y cálculo de los indicadores |

## Protocolos

Plantillas de trabajo para los clientes, públicas y sin indexar, con índice en `firmasvc.com/protocolos`. Cada protocolo tiene ficha configurable, herramientas interactivas, tarjeta de bolsillo e impresión, y combina tres capas, la legal, la de gestión y la de medición.

| Ruta | Protocolo |
|---|---|
| `/protocolo-llamadas` | Comunicación legal en llamadas de venta (componente propio) |
| `/protocolo-conflictos` | Conflictos y pedidos de reembolso |
| `/protocolo-onboarding` | Onboarding de clientes |
| `/protocolo-cobranza` | Cobranza y contracargos |
| `/protocolo-reclutamiento` | Reclutamiento y selección |
| `/protocolo-equipo` | Gestión del equipo |
| `/protocolo-marketing` | Marketing y publicidad |
| `/protocolo-datos` | Datos personales |

### Puesta en marcha

1. En Supabase corré `supabase/migraciones/0008_protocolos.sql` en **SQL Editor**. Suma los siete protocolos nuevos a Documentos, sección Otros documentos. Se puede correr más de una vez.
2. No hacen falta variables nuevas.

### Cómo está armado

1. `components/protocolos/motor` es el motor común. Recibe la definición de un protocolo y arma la página con índice, ficha, bloques de contenido, herramientas (semáforo, calculadora, rúbrica, evaluación por señales, plazos y listas de control), impresión y tarjeta de bolsillo. Usa los estilos del protocolo de llamadas.
2. Cada protocolo vive en su carpeta con `ficha.ts` (datos del negocio, valores y avisos), `contenido.ts` (secciones y bloques) e `index.ts` (definición).
3. Para sumar uno nuevo se crea la carpeta, se agrega su ruta en `components/protocolos/rutas.ts` y su carga en `components/protocolos/PaginaProtocolo.tsx`.
4. Regla de estilo de los textos, sin dos puntos ni rayas, y registro en lugar de grabación.

| Archivo | Para qué |
|---|---|
| `components/protocolos/rutas.ts` | Catálogo y rutas que resuelve el motor |
| `components/protocolos/PaginaProtocolo.tsx` | Página contenedora e índice de protocolos |
| `components/protocolos/motor/*` | Tipos, ficha, renderizador, herramientas y estilos del motor |
| `supabase/migraciones/0008_protocolos.sql` | Alta de los protocolos en Documentos |

## Pagos con tarjeta

Abonos mensuales de cada empresa cliente, cobrados con dLocal Go desde el portal. Cada abono tiene su propio plan de suscripción en dLocal Go, que el portal crea solo la primera vez que el titular lo activa. El cliente paga siempre en la moneda de su país y, si el abono es en dólares, dLocal Go lo convierte al momento de cada pago. La tarjeta se carga siempre en la página segura de dLocal Go y el portal nunca recibe ni guarda sus datos.

### Cómo funciona

1. En **Administración › Abonos** armás el abono como borrador con empresa, concepto, monto, moneda, periodicidad y mail del pagador. Con **Plan** se completan solos los de `/planes`: Gold, Black, Eminent y Eminent trimestral. La periodicidad es mensual o cada 3 meses, con un solo débito por adelantado. El país no se pregunta ni se muestra: en pesos el plan es de Argentina y en dólares va sin país, así el checkout de dLocal Go se lo pregunta al cliente. Mientras está por activar lo podés editar o borrar.
2. El titular lo ve en **Pagos** con sus condiciones, es decir concepto, monto, periodicidad, medio de pago, moneda en la que paga y cómo darse de baja. Para seguir tiene que tildar la autorización del débito mensual. La aceptación queda guardada con fecha, hora y usuario, y también en **Registro de accesos**.
3. La primera vez el portal crea el plan del abono en dLocal Go, mensual y con el país, la moneda y el monto del abono, y lleva al titular al enlace de suscripción del plan con su mail precargado. Al volver, el portal consulta a dLocal Go, avisa que el pago se está confirmando y la página se actualiza sola.
4. Cuando cambia un pago, dLocal Go avisa al portal. El aviso no se toma como verdad, solo dispara una consulta a la API de dLocal Go, que es la única fuente del estado, el próximo cobro y el historial. El botón **Actualizar estado** hace la misma consulta a mano, en Pagos y en Administración.
5. El titular se da de baja desde **Pagos** cuando quiera, con confirmación. El portal da de baja la suscripción y desactiva el plan, así no hay más cobros. La baja es inmediata.
6. dLocal Go no permite cambiar la tarjeta de una suscripción. Con **Cambiar medio de pago**, y después de una confirmación, el portal da de baja la suscripción vigente y lleva al titular a suscribirse de nuevo con el medio nuevo. Lo ya pagado se respeta, porque el plan le da esos días sin cobro a la suscripción nueva y el primer débito nuevo cae cuando vence lo pagado. Hasta que se vuelve a suscribir no hay débitos.
7. Un abono activo no cambia de monto. Para cambiarlo se da de baja y se arma otro.
8. **Pagos manuales.** Si el cliente paga por transferencia o cripto, en **Administración › Abonos** abrís el abono y usás **Registrar pago manual**, con fecha, monto, moneda, medio y una nota opcional. El pago aparece aprobado en el historial del cliente, con el medio. Si el abono no tiene débito con dLocal Go, queda **Activo y al día**: cada pago cubre un período (un mes, o tres si es trimestral) desde su fecha o desde el vencimiento anterior. Cuando el período vence sin un pago nuevo, el cliente ve **Pago vencido**. Si el abono sí tiene débito con dLocal Go, el pago solo queda en el historial. Un pago manual cargado por error se borra desde el historial y el vencimiento se recalcula. Los cobros de dLocal Go no se pueden borrar.

Los miembros del equipo del cliente no ven nada de pagos. Nadie escribe a mano el estado, el plan, la suscripción, la aceptación ni los pagos, tampoco el admin. Eso lo hacen solo las funciones del servidor.

### Puesta en marcha

Hacé todo primero en el sandbox de dLocal Go. Recién cuando la prueba completa sale bien, pasá a producción.

**1. Base de datos**

En Supabase abrí **SQL Editor › New query**, pegá todo `supabase/migraciones/0009_abonos.sql` y apretá **Run**. Crea las tablas `abonos` y `abono_pagos` con sus reglas y permisos. Después hacé lo mismo con `supabase/migraciones/0016_abonos_periodo.sql`, que suma los abonos trimestrales y los planes en dólares sin país. Las dos se pueden correr más de una vez.

**2. Credenciales de dLocal Go**

1. Entrá al panel de prueba de dLocal Go, `dashboard-sbx.dlocalgo.com`, con la cuenta de FIRMA.
2. En la sección de integración o API del panel copiá la **API key** y la **secret key**. Son `DLOCALGO_API_KEY` y `DLOCALGO_SECRET_KEY`.
3. Para cobrar de verdad, después de la prueba, sacá las dos claves del panel productivo de dLocal Go y cambiá `DLOCALGO_ENTORNO` a `produccion`.

No hace falta configurar avisos ni webhooks en el panel de dLocal Go. Cada plan lleva su propia dirección de aviso, `https://www.firmasvc.com/api/pagos/dlocalgo` con el id del abono y una clave, y el portal la arma sola al crear el plan.

**3. Variables en Vercel**

En **Settings › Environment Variables** cargá estas variables para Production y Preview. En Preview conviene dejar siempre el sandbox.

| Variable | Valor |
|---|---|
| `DLOCALGO_API_KEY` | API key de dLocal Go |
| `DLOCALGO_SECRET_KEY` | Secret key de dLocal Go |
| `DLOCALGO_ENTORNO` | `sandbox` para probar y `produccion` para cobrar. Si falta, es sandbox, así nadie cobra de verdad por error |
| `DLOCALGO_CLAVE_AVISOS` | Opcional. Una clave larga al azar para los avisos. Si falta se usa la clave service role |
| `PORTAL_URL` | `https://www.firmasvc.com` |

`PORTAL_URL` tiene que ser `https://www.firmasvc.com`, con www, porque el dominio sin www redirige y un aviso redirigido se pierde. Con ese valor las invitaciones al portal también salen con www, así que en Supabase, en **Authentication › URL Configuration**, sumá `https://www.firmasvc.com/portal/clave` a Redirect URLs. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` siguen como estaban.

**Estas claves mueven plata. Nunca con prefijo VITE_, ni en el código, ni en un chat.** Después de cargarlas hacé un redeploy.

Si falta la API key o la secret key, la API responde un error claro y en el portal el pago figura como no disponible. Los borradores se pueden armar igual. En **Administración › Abonos** se ve si dLocal Go está disponible y si está en sandbox o en producción.

Cada plan guarda su dirección de aviso con la clave y la dirección del momento en que se creó. Si después cambiás `DLOCALGO_CLAVE_AVISOS`, la clave service role o `PORTAL_URL`, los avisos de los planes ya creados dejan de validar. El estado se sigue actualizando al volver de dLocal Go y con Actualizar estado, pero conviene definir las tres antes del primer abono y no tocarlas.

**4. Prueba completa en el sandbox**

1. Armá un abono de ARS 100 para una empresa de prueba de Argentina, otro de USD 1 mensual y otro de USD 1 cada 3 meses.
2. Entrá con un usuario titular de esa empresa, aceptá el débito y suscribite a cada uno con las tarjetas de prueba que indica dLocal Go para el sandbox.
3. Revisá que pasen a Activo, que el pago aparezca en el historial con el monto pagado en la moneda del país y que los movimientos estén en **Registro de accesos**.
4. Probá Actualizar estado, Cambiar medio de pago y la baja. En el cambio de medio de pago revisá que dLocal Go no cobre de nuevo hasta que vence lo pagado.
5. Con esa prueba confirmá lo que el código marca como «verificar en sandbox». Son los nombres de los estados de suscripciones y cobros, la frecuencia del plan (mensual, y `MONTHLY` con `frequency_value` 3 para el trimestral), que en dólares sin país el checkout le pida el país al cliente, la forma de las listas y de los errores, qué moneda usa cada monto de un cobro y que los días sin cobro del plan corran el primer débito.
6. Recién después cargá las credenciales productivas y `DLOCALGO_ENTORNO` en `produccion`. Los abonos de prueba dalos de baja antes, porque sus planes no existen en producción.

**5. Clientes del exterior**

dLocal Go cobra en los países habilitados en la cuenta. Por defecto son Argentina, Bolivia, Brasil, Chile, Colombia, Costa Rica, Ecuador, Guatemala, Indonesia, Malasia, México, Paraguay, Perú y Uruguay, que son los que ofrece el portal. Antes de ofrecerlo a clientes de España o de Estados Unidos, confirmá con el soporte de dLocal Go si pueden pagar con tarjetas de esos países y en qué condiciones.

### Estados

| Estado | Qué significa |
|---|---|
| Por activar | Borrador de FIRMA que el titular todavía no aceptó |
| Confirmando pago | El titular aceptó y fue a dLocal Go, falta la confirmación |
| Falta el medio de pago | El titular dio de baja la suscripción para cambiar el medio de pago y todavía no se volvió a suscribir. No hay débitos |
| Activo | Débito mensual vigente |
| Problema de cobro | El último cobro fue rechazado. Con la suscripción vigente el titular puede cambiar el medio de pago, y si quedó sin efecto puede volver a suscribirse |
| De baja | Sin más débitos |

### Reglas

1. Cada abono tiene su propio plan en dLocal Go y su propia dirección de aviso, con una clave HMAC SHA256 del id del abono que se compara en tiempo constante. Un aviso con la clave equivocada se rechaza sin tocar nada.
2. Ningún aviso se toma al pie de la letra. dLocal Go no firma sus avisos, así que el aviso solo dispara una consulta a su API.
3. Repetir un aviso o una consulta no duplica pagos ni movimientos. Un pago aprobado no vuelve atrás, solo puede pasar a reintegrado.
4. Antes de dar un enlace de suscripción se revisa que el plan no tenga una suscripción vigente. Si igual aparecen dos, queda la más nueva, la otra se da de baja y queda en el registro para revisar y reintegrar el cobro de más.
5. Un abono dado de baja no se reactiva. Si en dLocal Go aparece una suscripción vigente de un abono dado de baja, se da de baja.
6. Si desactivás un plan desde el panel de dLocal Go, el abono pasa a De baja. Igual conviene hacer las bajas desde el portal.
7. Las claves nunca llegan al navegador ni quedan en el registro.

### Facturación e impuestos

Este módulo cobra pero no emite facturas. La facturación electrónica de cada cobro, los impuestos, las retenciones y el encuadre de los cobros al exterior se definen con el contador antes de activar el primer abono.

| Archivo | Para qué |
|---|---|
| `supabase/migraciones/0009_abonos.sql` | Tablas de abonos y pagos con país, plan y suscripción de dLocal Go, reglas, registro del alta y permisos |
| `api/pagos/activar.ts` | Constancia de aceptación, plan del abono en dLocal Go y enlace de suscripción. También informa si dLocal Go está listo y en qué entorno |
| `api/pagos/gestionar.ts` | Actualizar estado, baja y cambio de medio de pago |
| `api/pagos/dlocalgo.ts` | Avisos de dLocal Go con clave por abono, que disparan la actualización del estado |
| `components/portal/Pagos.tsx` | Sección Pagos del titular |
| `components/portal/admin/Abonos.tsx` | Pestaña Abonos de Administración |
| `components/portal/abonos.ts` | Tipos, rótulos, países, formatos y llamadas a la API |

Las tres funciones de `api/pagos` comparten un bloque común idéntico, con el cliente de dLocal Go y la sincronización, porque cada función de Vercel es autocontenida. Si se cambia en una, se cambia igual en las tres.

## Estado de asuntos

Cada trámite que FIRMA lleva para una empresa cliente, en `/portal/asuntos`: un contrato, un conflicto, una marca. Tiene tipo, estado (en curso, esperando al cliente, esperando a un tercero o finalizado), próximo paso, vencimiento y un historial de novedades.

- **Quién lo ve:** FIRMA, el titular y el CSM de la empresa. Closers y setters no.
- **FIRMA** crea el asunto con **Nuevo asunto** y edita sus datos.
- **Código.** Cada asunto recibe uno al crearse, como el de los clientes del CRM con `A-` adelante: `A-<prefijo de la empresa>-<número>`, por ejemplo `A-TB-001`. El número es correlativo por empresa y no cambia. Se busca por código en la lista y va al comienzo del asunto de cada mail.

Cada asunto tiene tres pestañas:

- **Chat.** Mensajes entre FIRMA y la empresa, en vivo con Supabase Realtime. Arriba se ve si la otra parte tiene el asunto abierto. Si no lo tiene, le llega un mail, como mucho uno cada 15 minutos por asunto y por lado.
- **Bitácora.** Las notas de FIRMA, cada una interna (solo FIRMA) o visible para el cliente, con aviso por mail opcional. Los cambios de estado y los documentos subidos se anotan solos. El cliente ve las entradas visibles y escribe por el chat.
- **Documentos.** FIRMA y el cliente suben PDF, Word, Excel, imágenes o TXT de hasta 20 MB al bucket privado `asuntos`. Se descargan con enlaces que vencen en un minuto. Cada subida le avisa por mail a la otra parte. Borra solo FIRMA.

Para activarlo, corré en Supabase › SQL Editor, en orden, `0017_asuntos.sql`, `0018_asuntos_chat_archivos.sql` y `0019_asuntos_codigo.sql`.

## Avisos por mail

Salen por Resend con la plantilla de FIRMA, desde `/api/portal/avisos`. Necesitan `RESEND_API_KEY`.

| Aviso | Cuándo | A quién |
|---|---|---|
| Nota visible de FIRMA en la bitácora | Al guardarla con «Avisar por mail» tildado | Titular y CSM de la empresa |
| Mensaje del chat | Si la otra parte no tiene el asunto abierto, como mucho uno cada 15 minutos | La otra parte: la empresa o FIRMA |
| Documento subido a un asunto | Siempre | La otra parte: la empresa o FIRMA |
| Documento nuevo | Al cargar un documento de una empresa con «Avisar por mail» tildado | Quienes lo pueden ver en el portal, según rol y áreas |

Cada aviso sale una sola vez y a cada persona por separado. Los documentos de la biblioteca común no se avisan, para no escribirle a todos los clientes a la vez.

| Archivo | Para qué |
|---|---|
| `supabase/migraciones/0017_asuntos.sql` | Tablas de asuntos y novedades, reglas y permisos |
| `supabase/migraciones/0018_asuntos_chat_archivos.sql` | Bitácora con notas internas, chat en vivo y documentos del asunto |
| `supabase/migraciones/0019_asuntos_codigo.sql` | Código A-<prefijo>-<número> de cada asunto |
| `components/portal/EstadoAsuntos.tsx` | Lista y detalle de asuntos |
| `components/portal/asuntos.ts` | Tipos, rótulos y el pedido de avisos |
| `api/portal/avisos.ts` | Avisos por mail de novedades y documentos |
| `api/portal/recuperar.ts` | Mail de «Olvidé mi contraseña» con la marca |

## Logos de clientes

Cada empresa puede tener su logo. Se ve en el header del portal al lado del de FIRMA para todo su equipo, y en el CRM y los casos de esa empresa. Cuando un admin elige una empresa en el CRM, ve el logo de esa empresa.

### Puesta en marcha

En Supabase abrí **SQL Editor › New query**, pegá todo `supabase/migraciones/0011_logos_clientes.sql` y apretá **Run**. Suma la columna `logo_url` a `organizaciones` y crea el bucket público `logos`, donde solo los admin de FIRMA pueden subir. Se puede correr más de una vez.

### Uso

En **Administración › Clientes › Editar** (o **Nuevo cliente**) tocá **Elegir logo**. PNG, JPG, WEBP o SVG de hasta 2 MB, mejor con fondo transparente. Se sube al guardar. **Quitar logo** lo borra.

| Archivo | Para qué |
|---|---|
| `supabase/migraciones/0011_logos_clientes.sql` | Columna del logo, bucket y permisos |
| `components/portal/logos.ts` | Subida, borrado y lectura del logo con caché |

## Servicios

Cada empresa carga lo que vende en **CRM legal › Servicios** (`/portal/crm/servicios`). Lo hace el titular, o vos desde la misma pantalla eligiendo la empresa en el CRM.

- **Nombre** y **código**. El código no se cambia después del alta porque lo usan las ventas ya cargadas.
- **Ticket**, opcional. Si está, aparece como monto sugerido al cargar una venta y se puede cambiar por un descuento. Si no hay precio fijo, se deja vacío y el monto se carga en cada venta.
- **Modelo de contrato**, solo FIRMA. Un Word con los datos a completar marcados, por ejemplo `[NOMBRE Y APELLIDO]`. Opcionalmente, uno distinto para pago total; si no está, Claude adapta el general.

## Contratos del CRM con firma electrónica

El CRM y la firma electrónica funcionan como un solo circuito. Reemplaza a los borradores que armaba Claude en Drive.

1. **Modelo por servicio.** FIRMA carga los contratos modelo en Word en **Documentos › Contratos de servicio**, comunes o exclusivos de una empresa. El titular elige cuál usa cada servicio en **CRM legal › Servicios**, y uno distinto para pago total si hace falta.
2. **Variables.** El Word lleva variables entre llaves dobles, por ejemplo `{{NOMBRE}}`, `{{DOMICILIO}}` o `{{DETALLE_CUOTAS}}`. La lista completa está en **Servicios › Variables de los modelos**, con un botón para copiar cada una. Funcionan en el cuerpo, en tablas, encabezados y pies, aunque Word las parta en tramos.
3. **Vista previa.** Al cargar la venta el portal completa el modelo con la ficha y el plan de pagos, lo pasa a PDF con Google Drive y lo muestra en la ficha. Si falta un dato obligatorio (por ejemplo el domicilio) avisa y no deja mandarlo hasta completarlo y generarlo de nuevo. Una variable que no existe queda tal cual y también se avisa.
4. **Firma.** Con **Mandar a firmar**, el cliente y quien firma por la empresa reciben su enlace y firman a la vez. Quien firma por la empresa se define en **Servicios › Quién firma por la empresa**; si está vacío, firma el titular.
5. **Seguimiento.** La ficha muestra en vivo quién abrió y quién firmó, con botones para copiar el enlace o reenviar el mail. El envío también aparece en **Firma electrónica**.
6. **Cierre.** Cuando firman los dos, el cliente pasa solo a **Firmado**, el contrato de servicio queda enlazado al envío y el PDF firmado se descarga desde la ficha.

Lo puede usar cualquier rol con acceso al CRM. Mientras hay un envío en curso no se puede generar otro; si se anula, se rechaza o vence, se genera y se manda de nuevo.

### Puesta en marcha

1. En Supabase corré `0014_crm_domicilio.sql` y `0015_crm_firma_unida.sql`.
2. En Vercel tienen que estar `GOOGLE_CREDS_JSON` y `GOOGLE_SUBJECT`, que ya se usaban para Drive. Drive se usa solo para pasar el Word a PDF: el documento temporal se borra al terminar.
3. Cargá los modelos en Word con sus variables en Documentos y elegilos en cada servicio.

`ANTHROPIC_API_KEY` y la carpeta de revisión de Drive de cada empresa ya no se usan para los contratos. La tabla `crm_borradores` y el bucket `modelos` quedan en la base sin uso.

| Archivo | Para qué |
|---|---|
| `supabase/migraciones/0015_crm_firma_unida.sql` | Modelo por servicio desde la biblioteca, firmante de la empresa, vista previa y envío atado al cliente |
| `api/_lib/variables.ts` | Lista de variables y cómo se calcula cada una. La usan el servidor, ZapSign y el portal |
| `api/_lib/word.ts` | Completa las variables del Word y lo pasa a PDF con Drive |
| `api/firma/sobres.ts` | Acciones `crm_vista`, `crm_pdf` y `crm_enviar` |
| `api/firma/firmar.ts` | Al completarse la firma, pasa el cliente a Firmado |
| `components/portal/crm/contratoFirma.tsx` | Contrato, vista previa, envío y seguimiento en la ficha |
| `components/portal/crm/Servicios.tsx` | Modelo de cada servicio, quién firma por la empresa y lista de variables |
