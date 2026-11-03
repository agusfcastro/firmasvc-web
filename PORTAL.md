# Portal de clientes FIRMA · Puesta en marcha del módulo 1

Accesos, roles, panel de administración y registro de ingresos. Se hace una sola vez y lleva unos 30 minutos.

## 1. Crear el proyecto en Supabase

1. Entrá a supabase.com con agustin@firmasvc.com y creá un proyecto llamado `firma-portal`. Región São Paulo (sa-east-1), la más cercana.
2. Guardá la contraseña de la base en tu gestor de contraseñas. No la vas a usar a diario.

## 2. Crear las tablas y los permisos

1. En Supabase abrí **SQL Editor › New query**.
2. Pegá todo el contenido de `supabase/migrations/0001_portal_accesos.sql` y apretá **Run**.

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

Las cuentas viejas con rol Miembro del equipo funcionan como CSM. Para que rijan estos roles corré `supabase/migrations/0012_roles_equipo.sql` en **SQL Editor**. Un documento cuenta como protocolo o formación cuando tiene marcada esa casilla en **Administración › Documentos**; la migración la marca sola en los protocolos que ya estaban.

Los permisos los aplica la base de datos. Aunque alguien manipule la página, un cliente no puede leer datos de otro.

### Verificación en dos pasos

Las cuentas Admin FIRMA, además de la contraseña, piden el código de 6 números de una app autenticadora (Google Authenticator, 1Password o similar). La primera vez que un admin entra, el portal le muestra un QR para registrar la app; después pide el código en cada ingreso. Con la contraseña sola una cuenta admin no ve nada: no lo deja el portal, ni la API, ni la base.

Puesta en marcha, en este orden:

1. En Supabase, **Authentication › Multi-Factor** (o **Sign In / Providers › Multi-Factor**), revisá que **TOTP** esté habilitado. Viene habilitado de fábrica.
2. Con el código desplegado, cada admin entra al portal y registra su app.
3. Recién entonces corré `supabase/migrations/0033_mfa_admin.sql` en **SQL Editor**. Hace que la base exija el segundo factor para los permisos de admin. Si la corrés antes de desplegar el código, los admins se quedan sin permisos en la base hasta que el portal tenga la pantalla del código.

Si un admin pierde el celular: en Supabase, **Authentication › Users**, abrí su usuario y borrá el factor en **Multi-Factor**. Al volver a entrar le pide registrar la app de nuevo. Guardá la clave de texto que muestra el alta, debajo del QR, en un lugar seguro: con ella podés cargar la app en otro celular.

## Archivos del módulo

| Archivo | Para qué |
|---|---|
| `supabase/migrations/0001_portal_accesos.sql` | Tablas, roles y permisos |
| `supabase/migrations/0033_mfa_admin.sql` | Los permisos de admin piden la verificación en dos pasos |
| `supabase/primer_admin.sql` | Alta de tu usuario admin |
| `api/admin/usuarios.ts` | Invitar, editar, activar y desactivar (servidor) |
| `components/portal/` | Pantallas del portal y del panel |
| `vercel.json` | Excluye `/api` del rewrite y marca `/portal` como no indexable |

## Módulo Documentos

Contratos de servicio, contratos con el equipo y otros documentos, en `firmasvc.com/portal/documentos`.

### Puesta en marcha

1. En Supabase abrí **SQL Editor › New query**, pegá todo `supabase/migrations/0005_documentos.sql` y apretá **Run**. Crea la tabla, los permisos y el espacio privado para los archivos.
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
| `supabase/migrations/0005_documentos.sql` | Tabla, permisos, bucket privado y registro de descargas |
| `components/portal/Documentos.tsx` | Vista del cliente con las tres secciones |
| `components/portal/admin/Documentos.tsx` | Carga, reemplazo y visibilidad desde Administración |
| `components/portal/descargas.ts` | Secciones, formatos y descargas |

## ZapSign, retirado

Los contratos del CRM se firman con la firma electrónica propia (ver *Contratos del CRM con firma electrónica*). La integración con ZapSign se sacó del portal en octubre de 2026 sin haber llegado a usarse. En la base quedan, vacías y sin uso, la tabla `zapsign_cuentas` y las columnas de la migración 0006.

## Firma electrónica propia

Sistema de firma propio, sin proveedores externos. Desde `firmasvc.com/portal/firmas` se sube un PDF, se cargan los firmantes y cada uno firma desde el mail. Al final todos reciben el PDF firmado, con una constancia de firma al final y el código de verificación en el pie de cada hoja.

Lo usan FIRMA, los titulares y los CSM. El titular ve todos los envíos de su empresa. El CSM, los que mandó él. Closer y setter no ven la sección.

### Cómo funciona

1. Quien envía sube el PDF, le pone título, plazo (3 a 90 días) y firmantes. Puede elegir que firmen en orden. FIRMA puede mandar a nombre propio o de un cliente.
2. El servidor valida el PDF, calcula su SHA-256 y lo guarda en el bucket privado `firmas`. A partir de ahí no se toca.
3. Cada firmante recibe un mail con su enlace personal (`/firmar/...`). El enlace es un sello HMAC y no se guarda en la base. Todo pasa en la web: el documento se ve hoja por hoja dentro de la página (pdf.js), sin abrirlo en el visor del navegador ni descargarlo, y se firma desde una barra fija abajo. Solo cuando firmaron todos aparece el botón para guardar una copia del PDF firmado.
4. Para firmar pide un código de 6 números que le llega al mail. Vence en 10 minutos, admite 5 intentos y como mucho 8 envíos. Validado, tiene media hora para firmar.
5. Firma dibujando o escribiendo su nombre, completa su documento si se lo piden y acepta el texto de consentimiento. Se guardan la imagen y su hash, la IP, el dispositivo y la hora.
6. Cuando firman todos, el servidor arma el PDF final: el original intacto, el pie con el código en cada hoja y la constancia con los datos del envío, cada firmante con su firma y el registro completo de eventos. Calcula su SHA-256 y lo manda adjunto a todos.
7. Cualquiera verifica un documento en `firmasvc.com/verificar`, subiendo el PDF (el hash se calcula en el navegador) o con el código.

### Por mail o por enlace

Al crear el envío (o al tocar **Mandar a firmar** en la ficha del CRM) se elige cómo les llega:

- **Por mail.** Lo de arriba: cada firmante recibe la invitación y confirma con el código.
- **Compartir el enlace.** No sale ningún mail. En la ficha del envío quien lo mandó copia el enlace de cada firmante y se lo pasa, por ejemplo en la llamada de onboarding. Se firma **sin código**, así que el enlace tiene que llegarle solo a esa persona. No hay recordatorios automáticos. El botón de reenviar le manda igual el enlace por mail si hace falta. La constancia del PDF firmado dice que el enlace lo entregó quien envió, sin código. La copia final del PDF firmado sí sale por mail a todos.

Necesita la migración `0027_firma_por_enlace.sql`. Sin ella, los envíos por mail siguen funcionando y los por enlace fallan al crearse.

Si alguien rechaza, el envío se cierra y avisa a quien lo mandó. Quien envía puede anular, reenviar el mail, copiar los enlaces para mandarlos por WhatsApp y descargar el original o el firmado.

### Registro de eventos

Cada paso queda en `firma_eventos`: creación, mails, aperturas, códigos pedidos, validados y fallidos, firmas, rechazos, anulaciones, descargas y el armado del PDF. Cada evento guarda el hash del anterior del mismo envío y la base no deja editarlos ni borrarlos. La ficha del envío y la página de verificación recalculan la cadena y avisan si no cierra.

### Puesta en marcha

1. En Supabase corré `supabase/migrations/0010_firma_electronica.sql` en **SQL Editor**. Crea las tablas, el registro encadenado y el bucket privado `firmas`.
2. En Resend verificá el dominio `firmasvc.com` (si ya lo usás para los mails del portal, está hecho) y creá una API key con permiso de envío.
3. En Vercel sumá estas variables y volvé a desplegar.

| Variable | Valor |
|---|---|
| `RESEND_API_KEY` | La API key de Resend. Sin ella el envío se crea igual, pero nadie puede pedir el código para firmar |
| `FIRMA_MAIL_DIRECCION` | Opcional. Remitente de los mails, por defecto `firmas@firmasvc.com` |
| `FIRMA_CLAVE_FIRMAS` | Obligatoria. Una clave larga al azar para los enlaces y los códigos (`openssl rand -hex 32`). Sin ella la firma electrónica no funciona. Cambiarla invalida los enlaces que estén en curso |
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
| `supabase/migrations/0010_firma_electronica.sql` | Envíos, firmantes, registro encadenado, permisos y bucket |
| `supabase/migrations/0027_firma_por_enlace.sql` | Columna `entrega` (mail o enlace) de cada envío |
| `api/firma/sobres.ts` | Crear, enlaces, recordar, anular y descargar, con la sesión del portal |
| `api/firma/firmar.ts` | Lado del firmante, armado del PDF, verificación pública y tarea diaria |
| `components/portal/firmas/` | Sección Firma electrónica del portal |
| `components/firma/FirmarApp.tsx` | Página pública para firmar |
| `components/firma/Verificar.tsx` | Página pública de verificación |

## Casos de conflicto

Registro de reclamos y pedidos de reembolso de cada cliente final, en `firmasvc.com/portal/crm/casos`. Con esos casos el CRM calcula los indicadores del tablero del protocolo de conflictos (`/protocolo-conflictos`).

### Puesta en marcha

1. En Supabase corré `supabase/migrations/0007_crm_casos.sql` en **SQL Editor**. Crea la tabla `crm_casos` con sus reglas, su historial y sus permisos. Se puede correr más de una vez.
2. No hacen falta variables nuevas.

### Uso

1. En el listado del CRM, **Casos de conflicto** abre el tablero y el registro, con todo el historial. El número rojo del botón son los casos en curso.
2. **Nuevo caso** abre el formulario. En la ficha de cada cliente, **Abrir un caso** lo abre con ese cliente elegido, y debajo del plan de pagos se listan sus casos.
3. Cada caso lleva apertura, causa, canal, monto reclamado, etapa, semáforo de la compuerta legal, derivación a legales y contracargo. Para cerrarlo se pasa a la etapa Cerrado con la decisión, la fecha de cierre y el monto concedido.
4. No hay corte por mes: indicadores y registro son históricos. **Mostrar** elige cuántos casos se ven por página (10, 20 o 30), con **Anteriores** y **Siguientes**.
5. **Eliminar caso** borra también su asunto de Estado de asuntos, con su chat, su bitácora y sus documentos. La baja queda en el historial del cliente. Requiere `0026_borrar_caso_y_asunto.sql`, que además borra los asuntos de reembolso que quedaron sin caso.

### Indicadores

| Indicador | Cálculo |
|---|---|
| Abiertos hoy | Casos en curso hoy |
| Reclamos cada 100 ventas | Casos abiertos sobre clientes dados de alta en el CRM, por cien |
| Resueltos antes de legales | Cerrados sin derivación sobre el total de cerrados |
| Tiempo medio de resolución | Días entre apertura y cierre de los cerrados |
| Costo de concesiones | Monto concedido en los cerrados sobre el monto total de las altas. Con más de una moneda se calcula por moneda, sin convertir |
| Contracargos | Casos con contracargo y porcentaje ganado sobre los recibidos |
| Causas raíz | Casos por causa, de mayor a menor |

### Reglas

1. La empresa ve, carga y edita sus casos. Borran solo el titular y FIRMA. Nadie ve casos de otra empresa.
2. La organización del caso es siempre la del cliente y los montos van en la moneda del cliente.
3. Un caso cerrado tiene decisión y fecha de cierre, que no puede ser anterior a la apertura. Uno abierto no lleva fecha de cierre. El resultado del contracargo solo se carga si hubo contracargo.
4. Un caso en legales o en difusión pública queda marcado como derivado a legales.
5. Cada alta, cambio o baja de un caso queda en el historial de la ficha del cliente.

| Archivo | Para qué |
|---|---|
| `supabase/migrations/0007_crm_casos.sql` | Tabla de casos, reglas de coherencia, historial y permisos |
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

1. En Supabase corré `supabase/migrations/0008_protocolos.sql` en **SQL Editor**. Suma los siete protocolos nuevos a la biblioteca. Se puede correr más de una vez.
3. En el portal, los documentos con la casilla de protocolo o formación se ven en **Protocolos** (`/portal/protocolos`), no en las secciones de Documentos. La tarjeta Protocolos del inicio entra ahí. Closer y setter, que no ven documentos legales, solo tienen esa vista.
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
| `supabase/migrations/0008_protocolos.sql` | Alta de los protocolos en Documentos |

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

En Supabase abrí **SQL Editor › New query**, pegá todo `supabase/migrations/0009_abonos.sql` y apretá **Run**. Crea las tablas `abonos` y `abono_pagos` con sus reglas y permisos. Después hacé lo mismo con `supabase/migrations/0016_abonos_periodo.sql`, que suma los abonos trimestrales y los planes en dólares sin país. Las dos se pueden correr más de una vez.

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
| `DLOCALGO_CLAVE_AVISOS` | Obligatoria. Una clave larga al azar para los avisos (`openssl rand -hex 32`). Sin ella el pago aparece como no disponible |
| `PORTAL_URL` | `https://www.firmasvc.com` |

`PORTAL_URL` tiene que ser `https://www.firmasvc.com`, con www, porque el dominio sin www redirige y un aviso redirigido se pierde. Con ese valor las invitaciones al portal también salen con www, así que en Supabase, en **Authentication › URL Configuration**, sumá `https://www.firmasvc.com/portal/clave` a Redirect URLs. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` siguen como estaban.

**Estas claves mueven plata. Nunca con prefijo VITE_, ni en el código, ni en un chat.** Después de cargarlas hacé un redeploy.

Si falta la API key o la secret key, la API responde un error claro y en el portal el pago figura como no disponible. Los borradores se pueden armar igual. En **Administración › Abonos** se ve si dLocal Go está disponible y si está en sandbox o en producción.

Cada plan guarda su dirección de aviso con la clave y la dirección del momento en que se creó. Si después cambiás `DLOCALGO_CLAVE_AVISOS` o `PORTAL_URL`, los avisos de los planes ya creados dejan de validar. El estado se sigue actualizando al volver de dLocal Go y con Actualizar estado, pero conviene definir las tres antes del primer abono y no tocarlas.

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
| `supabase/migrations/0009_abonos.sql` | Tablas de abonos y pagos con país, plan y suscripción de dLocal Go, reglas, registro del alta y permisos |
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
- **Quién lo crea:** FIRMA y también el titular o el CSM, con **Nuevo asunto**. Lo que escribe el cliente al crearlo queda como primer mensaje del chat y le llega a FIRMA por mail. Editar los datos y el estado sigue siendo de FIRMA.
- **Cliente del CRM.** Un asunto puede vincularse a un cliente de la empresa. Es opcional, salvo en un reembolso o contracargo. La ficha del cliente lista sus asuntos y tiene **Nuevo asunto**, que lo abre ya vinculado.
- **Aviso de asunto nuevo.** Cuando el cliente abre un asunto, a FIRMA le llega un mail «Nuevo asunto de {empresa}» con el tipo, el cliente y lo que contó.
- **Corregir la clasificación.** En **Editar datos**, FIRMA cambia tipo, motivo y cliente. Si pasa a Conflicto › Reembolso o contracargo, pide la causa y al guardar abre el caso de conflicto, con la fecha del asunto. Si el asunto ya tiene caso, esos tres datos quedan fijos.
- **Motivo.** Los asuntos de tipo Conflicto llevan uno: Reembolso o contracargo, Incumplimiento de entregables, Cobro de sumas adeudadas, Conflicto con el equipo u Otro conflicto.
- **Reembolso o contracargo.** Abre además su caso de conflicto (causa, canal, monto, contracargo), que cuenta en los indicadores de CRM › Casos de conflicto. El asunto muestra la etapa, el semáforo con lo que indica el protocolo y un enlace para seguir el caso. Al cerrar el caso el asunto pasa a finalizado, y al reabrirlo vuelve a en curso. Un caso creado desde CRM › Casos de conflicto crea su asunto solo.
- **Código.** Cada asunto recibe uno al crearse, como el de los clientes del CRM con `A-` adelante: `A-<prefijo de la empresa>-<número>`, por ejemplo `A-TB-001`. El número es correlativo por empresa y no cambia. Se busca por código en la lista y va al comienzo del asunto de cada mail.

Cada asunto tiene tres pestañas:

- **Chat.** Mensajes entre FIRMA y la empresa, en vivo con Supabase Realtime. Arriba se ve si la otra parte tiene el asunto abierto. Si no lo tiene, le llega un mail, como mucho uno cada 15 minutos por asunto y por lado.
- **Bitácora.** Las notas de FIRMA, cada una interna (solo FIRMA) o visible para el cliente, con aviso por mail opcional. Los cambios de estado y los documentos subidos se anotan solos. El cliente ve las entradas visibles y escribe por el chat.
- **Documentos.** FIRMA y el cliente suben PDF, Word, Excel, imágenes o TXT de hasta 20 MB al bucket privado `asuntos`. Se descargan con enlaces que vencen en un minuto. Cada subida le avisa por mail a la otra parte. Borra solo FIRMA.

Para activarlo, corré en Supabase › SQL Editor, en orden, `0017_asuntos.sql`, `0018_asuntos_chat_archivos.sql`, `0019_asuntos_codigo.sql`, `0024_asuntos_conflictos.sql` y `0026_borrar_caso_y_asunto.sql`. La 0024 le crea un asunto a cada caso de conflicto que ya existía, con su fecha y sus notas, sin tocar el caso ni su historial.

## Pedidos de contrato

Formulario para pedirle a FIRMA un contrato, por ahora el de closer. Se abre desde **Documentos › Contratos con tu equipo › Completar el formulario** (`/portal/pedidos/closer`).

- **Quién lo completa:** el titular y el CSM, los mismos que ven los asuntos. Closers y setters no lo ven.
- **Sin datos de la empresa.** Ya los tiene FIRMA, así que el formulario empieza por el closer.
- **Por pasos.** Son 10 secciones: closer, puesto, honorarios, bonos, objetivos, reembolsos, pago, plazo, protección y cierre. Cada pregunta aparece según las respuestas anteriores: sin bonos por hitos no se pide la escala. Lo habitual ya viene marcado y el cliente cambia solo lo que difiere.
- **Avisos.** Las respuestas que acercan la relación a un empleo (horarios, exclusividad, descuentos por objetivos, no competencia) muestran una nota al lado. FIRMA las ve también en las respuestas.
- **Borrador.** Se guarda solo un segundo después de cada cambio. Los borradores sin enviar aparecen en la misma tarjeta para seguirlos o descartarlos.
- **Enviar.** Abre un asunto de tipo Contrato, «Contrato de closer · <nombre>», con un primer mensaje en el chat y el mail de asunto nuevo a FIRMA. Las respuestas quedan en la pestaña **Formulario** del asunto, con **Copiar respuestas** para pegarlas en el borrador. Una vez enviado, las condiciones quedan fijas: los cambios van por el chat y el manual o los guiones se suben en Documentos.
- **Datos del closer para después.** Ninguno es obligatorio, porque muchas veces el contrato se arma antes de elegir a la persona. Si faltan, el asunto se llama «Contrato de closer · datos del closer pendientes» y la pestaña Formulario lo avisa. El cliente los completa desde ahí (**Completalos acá**): se guardan, el asunto toma el nombre del closer y a FIRMA le llega un mensaje por el chat. Es lo único que se edita después de enviar, y la base lo controla.
- **Esquema.** Al enviar, **Guardar estas condiciones como esquema** (prendido la primera vez) guarda todo menos los datos del closer. El próximo contrato de closer de la empresa arranca con esas condiciones y, después de los datos del closer, va directo a revisar. Cada sección se puede cambiar desde la revisión, y al enviar se elige si actualizar el esquema. Hay uno por empresa: la tarjeta de Documentos muestra la fecha y permite borrarlo.
- Borrar el asunto borra también el formulario.

Las preguntas están en `components/portal/pedidos/closer.ts`. Para sumar otro modelo, se arma su archivo con el mismo formato y se agrega a `MODELOS` y al `check` de la columna `modelo` de las dos tablas. Las claves de la sección de la persona empiezan con `closer_`, que es como la base las reconoce en la 0035.

Para activarlo, corré `0034_pedidos_contrato.sql` y después `0035_esquemas_contrato.sql`.

| Archivo | Para qué |
|---|---|
| `supabase/migrations/0034_pedidos_contrato.sql` | Tabla, permisos y bloqueo después de enviar |
| `supabase/migrations/0035_esquemas_contrato.sql` | Esquemas por empresa y datos del closer después de enviar |
| `components/portal/pedidos/formulario.ts` | Tipos de pregunta, avance, faltantes y resumen |
| `components/portal/pedidos/closer.ts` | Preguntas del contrato de closer |
| `components/portal/pedidos/Pedidos.tsx` | Formulario, tarjeta de Documentos y pestaña del asunto |

## Planes, agenda y firmas

El plan de cada empresa se elige en Administración › Clientes › Editar: Gold, Black, Eminent o A medida.

| Plan | Agenda | Documentos firmados |
|---|---|---|
| Gold | 60 minutos por mes calendario | 20 por mes calendario |
| Black | 60 minutos por semana, de lunes a domingo | 50 por mes calendario |
| Eminent | Sin límite | Sin límite |
| A medida | Sin límite | Sin límite |

- **Agenda.** Después de cada reunión cargá los minutos en Administración › Agendas › Tiempo de reuniones. El cliente ve la barra en Agenda. Una reunión puede pasarse del saldo: el exceso se le muestra como tiempo recibido de más. Con el tiempo agotado deja de ver los enlaces de reserva hasta que se renueva el período y se le ofrece escribir por WhatsApp. Un consumo cargado por error se borra desde la misma lista y vuelve al saldo.
- **Firmas.** Ocupan el cupo los envíos de la empresa firmados en el mes, incluidos los contratos del CRM, y los que siguen en curso, que reservan su lugar. Así el tope no se pasa. Un envío anulado o vencido libera el lugar. Los envíos de FIRMA no cuentan. Al llegar al límite no puede crear envíos nuevos, ni desde la pantalla ni por la API, y se le ofrece escribir por WhatsApp.

Para activarlo, corré `0022_planes_agenda_firmas.sql` y `0025_higiene_y_cupo_firmas.sql`. Las fechas son de Buenos Aires.

## Borrar datos de prueba

- **Abono de prueba.** En Administración › Abonos, un abono dado de baja tiene **Borrar abono de prueba**, que lo borra con su historial de pagos. Un borrador se borra como siempre.
- **Empresa de prueba.** Desactivala en Clientes › Editar y guardá. Al volver a editarla aparece **Borrar empresa de prueba**, que pide escribir su nombre y borra la empresa con sus usuarios y sus cuentas de acceso, CRM, casos, asuntos, documentos, abonos, pagos y archivos. Una empresa con envíos a firma electrónica no se borra: el registro de cada firma es evidencia. Queda desactivada.
- El historial del CRM y el registro de accesos no se borran. El borrado queda anotado en el registro.

Para activarlo, corré `0023_borrar_empresa.sql`.

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
| `supabase/migrations/0017_asuntos.sql` | Tablas de asuntos y novedades, reglas y permisos |
| `supabase/migrations/0018_asuntos_chat_archivos.sql` | Bitácora con notas internas, chat en vivo y documentos del asunto |
| `supabase/migrations/0019_asuntos_codigo.sql` | Código A-<prefijo>-<número> de cada asunto |
| `components/portal/EstadoAsuntos.tsx` | Lista y detalle de asuntos |
| `components/portal/asuntos.ts` | Tipos, rótulos y el pedido de avisos |
| `api/portal/avisos.ts` | Avisos por mail de novedades y documentos |
| `api/portal/recuperar.ts` | Mail de «Olvidé mi contraseña» con la marca |

## Mail de los lunes y alertas

Mails que el portal manda solo, sin que nadie los pida, desde `/api/portal/resumen`. Corre todos los días a las 9 de Buenos Aires con Vercel Cron. En el plan Hobby de Vercel la tarea puede salir en cualquier momento entre las 9 y las 10. Las empresas desactivadas y la demo no reciben nada.

**Alertas de vencimientos.** Todos los días, un solo mail por persona con todo lo que vence pronto en su empresa, y uno a FIRMA con todas las empresas.

| Qué | Cuándo avisa | A quién |
|---|---|---|
| Asunto abierto con vencimiento | 7 días antes y el día anterior | Titular y CSM, y FIRMA |
| Envío a firma en curso | 3 días antes de que venza | Titular y CSM, y FIRMA |
| Abono con fecha de fin (Vigente hasta) | 30 días antes y 7 días antes | Titular, y FIRMA |

Cada alerta sale una vez por umbral. Si cambia la fecha de vencimiento, se vuelve a avisar con la nueva.

**Mail de los lunes.** Un solo mail por persona, en este orden:

| Parte | Qué lleva | A quién |
|---|---|---|
| Novedades | El video y el artículo de la semana, cargados en Administración › Newsletter | Todos los usuarios de la empresa |
| Vencimientos de esta semana | Asuntos y envíos a firma que vencen de lunes a domingo, y el abono si termina esa semana (este solo al titular) | Titular y CSM |
| Tu semana en resumen | Una línea por tema: asuntos abiertos y cuáles esperan su respuesta, asuntos con novedades, finalizados, firmas en curso y completadas, documentos nuevos | Titular y CSM |

El mail de los lunes sale solo si activaste la newsletter de esa semana. Sin una newsletter activada, ese lunes no sale nada, tampoco el resumen. Las alertas de vencimientos no dependen de esto. Si el lunes no alcanzó el tiempo de la función, el martes y el miércoles manda lo que faltó.

**Newsletter.** En Administración › Newsletter, **Nueva newsletter**: el lunes en que sale, el video (título y enlace) y el artículo (título, bajada y enlace). Alcanza con uno de los dos. Los videos de YouTube muestran su miniatura en el mail; Vimeo, Loom y otros van como enlace. Se guarda como Borrador.

1. **Enviarme una prueba** te la manda al mail, como la ve un closer.
2. **Activar envío** la deja lista para salir ese lunes a las 9. Hasta las 9 se puede **Desactivar**, editar o borrar.
3. Después de salir queda como Enviada y ya no se edita.

**Baja.** El pie del mail de los lunes tiene «Dejar de recibir este mail». Lleva a una página que pide un clic, así un filtro de correo que abre el enlace no da de baja a nadie. Gmail y Apple Mail muestran además su botón de baja (List-Unsubscribe). Desde la misma página se vuelve a recibir. Las alertas no se dan de baja, porque suelen tener plazos. Cada cambio queda en el registro.

### Puesta en marcha

1. Corré `0032_resumen_y_alertas.sql` en Supabase › SQL Editor.
2. En Vercel cargá `PORTAL_CLAVE_AVISOS` con `openssl rand -hex 32`. `CRON_SECRET` y `RESEND_API_KEY` ya están por la firma electrónica.
3. Redeploy. Para probar sin esperar al lunes, llamá a la tarea con el mail de los lunes forzado. Manda de verdad a todos, una vez por persona y por semana. Para ver solo la newsletter, usá **Enviarme una prueba**.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://www.firmasvc.com/api/portal/resumen?resumen=1"
```

| Archivo | Para qué |
|---|---|
| `supabase/migrations/0032_resumen_y_alertas.sql` | Preferencia del mail de los lunes, newsletters y registro de lo que ya salió |
| `api/portal/resumen.ts` | Tarea diaria, alertas, mail de los lunes, prueba y página de baja |
| `components/portal/admin/Newsletter.tsx` | Administración › Newsletter |

## Logos de clientes

Cada empresa puede tener su logo. Se ve en el header del portal al lado del de FIRMA para todo su equipo, y en el CRM y los casos de esa empresa. Cuando un admin elige una empresa en el CRM, ve el logo de esa empresa.

### Puesta en marcha

En Supabase abrí **SQL Editor › New query**, pegá todo `supabase/migrations/0011_logos_clientes.sql` y apretá **Run**. Suma la columna `logo_url` a `organizaciones` y crea el bucket público `logos`, donde solo los admin de FIRMA pueden subir. Se puede correr más de una vez.

### Uso

En **Administración › Clientes › Editar** (o **Nuevo cliente**) tocá **Elegir logo**. PNG, JPG, WEBP o SVG de hasta 2 MB, mejor con fondo transparente. Se sube al guardar. **Quitar logo** lo borra.

| Archivo | Para qué |
|---|---|
| `supabase/migrations/0011_logos_clientes.sql` | Columna del logo, bucket y permisos |
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
3. **Vista previa.** Al cargar la venta el portal completa el modelo con la ficha y el plan de pagos, lo pasa a PDF con Google Drive y lo muestra en la ficha. Con **Descargar PDF** se baja el archivo, por ejemplo para subirlo a otro lado. Si falta un dato obligatorio (por ejemplo el domicilio) avisa y no deja mandarlo hasta completarlo y generarlo de nuevo. Una variable que no existe queda tal cual y también se avisa.
4. **Firma.** Con **Mandar a firmar**, el cliente y quien firma por la empresa reciben su enlace y firman a la vez. Quien firma por la empresa se define en **Servicios › Quién firma por la empresa**; si está vacío, firma el titular.
5. **Seguimiento.** La ficha muestra en vivo quién abrió y quién firmó, con botones para copiar el enlace o reenviar el mail. El envío también aparece en **Firma electrónica**.
6. **Cierre.** Cuando firman los dos, el cliente pasa solo a **Firmado**, el contrato de servicio queda enlazado al envío y el PDF firmado se descarga desde la ficha.

Lo puede usar cualquier rol con acceso al CRM. Mientras hay un envío en curso no se puede generar otro; si se anula, se rechaza o vence, se genera y se manda de nuevo.

**Contratos que no salen del modelo.** En **Firma electrónica › Nuevo envío** se puede elegir un **Cliente del CRM** de la empresa (opcional). El envío queda atado a ese cliente: lo ve quien ve al cliente, aparece en su ficha en **Otros documentos vinculados** y, cuando firman todos, el cliente pasa a Firmado con el enlace al documento. Al elegir el cliente se propone como primer firmante.

**Rechazos y vencimientos.** Si el último envío de un cliente pendiente se rechaza, vence o se anula, la lista del CRM lo marca en rojo (Firma rechazada, Envío vencido o Envío anulado) y la ficha muestra en rojo cómo terminó, con el motivo del rechazo, para volver a mandarlo. Quien mandó el envío además recibe el mail de rechazo, como antes.

### Puesta en marcha

1. En Supabase corré `0014_crm_domicilio.sql` y `0015_crm_firma_unida.sql`.
2. En Vercel tienen que estar `GOOGLE_CREDS_JSON` y `GOOGLE_SUBJECT`, que ya se usaban para Drive. Drive se usa solo para pasar el Word a PDF: el documento temporal se borra al terminar.
3. Cargá los modelos en Word con sus variables en Documentos y elegilos en cada servicio.

`ANTHROPIC_API_KEY` y la carpeta de revisión de Drive de cada empresa ya no se usan para los contratos. La tabla `crm_borradores` y el bucket `modelos` quedan en la base sin uso.

| Archivo | Para qué |
|---|---|
| `supabase/migrations/0015_crm_firma_unida.sql` | Modelo por servicio desde la biblioteca, firmante de la empresa, vista previa y envío atado al cliente |
| `api/_lib/variables.ts` | Lista de variables y cómo se calcula cada una. La usan el servidor y el portal |
| `api/_lib/word.ts` | Completa las variables del Word y lo pasa a PDF con Drive |
| `api/firma/sobres.ts` | Acciones `crm_vista`, `crm_pdf` y `crm_enviar` |
| `api/firma/firmar.ts` | Al completarse la firma, pasa el cliente a Firmado |
| `components/portal/crm/contratoFirma.tsx` | Contrato, vista previa, envío y seguimiento en la ficha |
| `components/portal/crm/Servicios.tsx` | Modelo de cada servicio, quién firma por la empresa y lista de variables |

## Migraciones, pruebas y marca

### Migraciones con Supabase CLI

Las migraciones viven en `supabase/migrations/` (antes `supabase/migraciones/`) con el mismo nombre de siempre, `NNNN_descripcion.sql`. Supabase CLI las lee de ahí y en ese orden. Una migración nueva lleva el número siguiente.

Se pueden seguir corriendo a mano en **SQL Editor**, como hasta ahora. Para pasar a `supabase db push`, hay que hacer una vez la línea base, así la CLI sabe que las que ya están en producción no se vuelven a correr:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <ref del proyecto, en Project Settings › General>
```

```bash
npx supabase migration list
```

Después, por cada migración que ya corriste en el SQL Editor y la lista muestra solo en Local, marcala como aplicada (sin correrla). Por ejemplo, para todas hasta la 0035:

```bash
npx supabase migration repair --status applied 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0012 0013 0014 0015 0016 0017 0018 0019 0020 0021 0022 0023 0024 0025 0026 0027 0028 0029 0030 0031 0032 0033 0034 0035
```

Desde ahí, `npx supabase db push` corre solo las nuevas. `supabase/config.toml` describe el login del portal para la base local (sin registro abierto, contraseña de 10 con letras y números, TOTP). No cambia producción salvo que se use `supabase config push`.

### Pruebas

| Comando | Qué hace |
|---|---|
| `npm run typecheck` | Revisa los tipos de TypeScript de todo el proyecto |
| `npm run marca:verificar` | Compara los colores de `api/_lib/marca.ts` con los de `index.css` |
| `npm run db:probar` | Corre todas las migraciones sobre un Postgres vacío en memoria (PGlite) y después las pruebas de `supabase/pruebas/` |

`db:probar` no necesita Docker ni toca producción. `supabase/pruebas/_supabase.sql` simula lo mínimo de Supabase (roles, `auth.uid()`, `auth.jwt()`, Storage). `aislamiento_negocios.sql` comprueba que un negocio no lee, carga, edita ni borra datos de otro, lo que ve cada rol, y que el admin sin segundo factor no ve nada. Cada prueba nueva va en un archivo `.sql` en esa carpeta y usa `pruebas.como(usuario, aal)` para actuar como un usuario y `pruebas.ok(condición, mensaje)` para comprobar.

GitHub Actions (`.github/workflows/verificar.yml`) corre las tres en cada push y, además, aplica todas las migraciones sobre la imagen real de Supabase.

### Tokens de diseño

Colores, radios, sombras y tipografías están en `index.css`, dentro de `@theme`. Cada token se usa como clase de Tailwind: `text-peligro`, `bg-bosque-suave`, `shadow-hoja`, `rounded-tarjeta`. Para aplicar un manual de marca se cambian los valores ahí, sin tocar componentes.

| Grupo | Tokens |
|---|---|
| Marca | `marfil`, `marfil-oscuro`, `marfil-claro`, `carbon`, `tinta`, `piedra`, `calido`, `bosque`, `bosque-dark`, `bosque-suave`, `bosque-claro` |
| Portal | `papel` (tarjetas), `borde` (campos, 3,6 a 1 sobre blanco), `borde-suave` (tarjetas), `separador` (filas), `lateral-texto` y `lateral-tenue` (barra lateral) |
| Líneas | `linea`, `linea-suave` |
| Estados | `peligro`, `peligro-fuerte`, `peligro-suave`, `peligro-borde`, `peligro-claro`, `aviso`, `aviso-suave`, `aviso-claro`, `urgente` |
| Radios | `control`, `tarjeta` (0, ángulo recto) y `pastilla` |
| Sombras | `suave`, `hoja`, `flotante` |
| Tipografía | `font-sans` (Archivo), `font-heading` (Bitter) |

Los mails, el PDF firmado y los dibujos en canvas no leen CSS. Toman los colores de `api/_lib/marca.ts`, que tiene que coincidir con `index.css`; `npm run marca:verificar` lo controla. No escribas colores con `[#...]` en los componentes: si falta uno, sumalo como token.

`npm run marca:verificar` también controla el contraste WCAG 2.2 AA de los pares que usa el portal: 4,5 a 1 para texto y 3 a 1 para el contorno de un campo. Si cambiás un color y deja de pasar, el script dice qué par falla y con cuánto.

### Diseño del portal

El portal usa una escala de aplicación, distinta de la de la landing. Todo vive dentro de `Marco` (`components/portal/ui.tsx`), que lleva la clase `.portal`.

| Pieza | Cómo es |
|---|---|
| Barra lateral | Verde bosque (`bosque-dark`), 264 px, fija en computadora. Bloque de la empresa con su logo, rol y plan; si la persona es miembro de varios negocios, ese bloque es el selector. Secciones agrupadas en Expediente y Tu negocio (para FIRMA, Clientes, Gestión y FIRMA), con contadores de lo que espera en Asuntos y en Firmas. Abajo, el acceso a la agenda y la cuenta con Salir |
| Celular | Barra superior verde bosque con el logo y el menú, y barra inferior con las cuatro secciones más usadas según el rol y Más, que abre el mismo lateral |
| Encabezado | `Encabezado` es compacto: línea de contexto en 13 px, título en Bitter 700 de 26 a 36 px (`p-titulo`, `p-titulo-grande`), bajada en 15 px y acciones a la derecha |
| Tarjetas | `p-tarjeta` (papel con filete `borde-suave`) y `p-tarjeta-cabeza` para el título de la tarjeta en Bitter 600. El oscuro queda para el lateral y los paneles de acento (`panel-carbon`, que en el portal se ve verde bosque) |
| Escala | Dentro de `.portal`, `.section` mide 24 a 32 px de alto, `.wrap` llega a 1240 px, `.h1` a `.h3` y `.eyebrow` bajan a escala de app y sin versalitas. Las tablas (`.tabla`) y las cifras (`.cifras`) se ven en papel |
| Botones | `Marco` envuelve todo en `DensidadBotones` compacta: botones de 36 a 48 px y el secundario sobre papel. La landing sigue igual |
| Campos | `claseInput` con borde `borde`, foco de 2 px en verde bosque, etiquetas de 13 px (`Campo`). El foco visible de teclado vale para todo el sitio |
| Estados | `Etiqueta` es una pastilla de 12 px con mayúscula inicial |

El inicio (`Inicio.tsx`) muestra lo que la persona tiene que resolver, con datos reales: firmas que le faltan firmar o vencen en tres días, asuntos que esperan su respuesta o vencen en una semana, pedidos de contrato sin enviar, problemas con el débito y, para el closer, clientes del CRM con la firma pendiente. Arriba van las cifras y al costado el plan, la agenda y los accesos. FIRMA ve un inicio propio con los problemas de cobro, los errores de sellado, los pedidos nuevos y los asuntos que vencen en la semana.

## Multitenant: membresías, equipo, variables, planes y bitácora

Etapa 2, migraciones 0036 a 0043.

| Migración | Qué hace |
|---|---|
| `0036_membresias.sql` | Una persona puede pertenecer a varios negocios, con rol y áreas en cada uno. Trabaja en uno por vez: `perfiles.organizacion_id`, `rol` y `areas` reflejan la membresía activa, así lo que ya leía el perfil sigue igual. `cambiar_organizacion(org)` pasa a otro negocio. Desactivar una membresía corta el acceso a ese negocio en el acto. La API de Usuarios sigue escribiendo el perfil y la membresía se crea sola |
| `0037_equipo.sql` | `equipo_miembros`: closers, setters, account managers y CSM de cada negocio, con o sin cuenta. Cada cliente del CRM puede llevar `closer_id`, `setter_id` y `responsable_id`. Lo ve todo el negocio y lo administra el titular. No se borran, se desactivan |
| `0038_claves_por_negocio.sql` | Las tablas hijas apuntan al padre por `(organizacion_id, id)`. La base rechaza que un pago, caso, contrato, mensaje o pago de abono apunte a algo de otro negocio |
| `0039_variables_negocio.sql` | Variables propias de cada negocio para los modelos de contrato, por negocio (`org_variables_valor`) o por cliente (`crm_clientes.datos_extra`). Se validan clave y tipo. Las 28 fijas de `api/_lib/variables.ts` están reservadas en `variable_de_sistema()`; si se suma una allá, va también ahí (`npm run db:probar` lo controla) |
| `0040_planes_producto.sql` | `plan_producto` (Radar, Escudo, Blindaje) convive con el plan de servicio (Gold, Black, Eminent). Solo habilita funcionalidades nuevas. La matriz está en `planes_funcionalidades` y las excepciones de un negocio en `org_funcionalidades`. Se consulta siempre con `tiene_funcionalidad(org, clave)` y `limite_funcionalidad(org, clave)` |
| `0041_bitacora.sql` | `registro_accesos` pasa a ser la bitácora: cada registro con su negocio, marca de si lo hizo FIRMA, encadenado por hash e inmutable. El titular lee la de su negocio. `bitacora_verificar(org)` recalcula la cadena. Los registros anteriores quedan fuera de la cadena |

| `0042_cifrado_datos.sql` | DNI, teléfono y domicilio de los clientes del CRM se guardan cifrados (pgcrypto, AES) con la clave `crm_datos` de Supabase Vault. Quien guarda sigue escribiendo `dni`, `telefono` y `domicilio`: un trigger los cifra y deja la columna vacía. En un update, `null` deja el dato, `''` lo borra y un valor lo reemplaza. `crm_clientes_resumen` los devuelve descifrados solo a quien puede ver el negocio y a las funciones del servidor. `dni_indice` y `telefono_indice` (HMAC con la clave `crm_indices`) sirven para buscar por igualdad. El historial anota «(dato protegido)» en vez del valor, también en lo que ya tenía |
| `0043_acceso_vigente.sql` | `acceso_vigente(usuario)` da el negocio activo solo si el perfil, el negocio y la membresía están activos. Las funciones del servidor que atienden a usuarios de clientes (firma, avisos y pagos) lo consultan antes de operar, así desactivar una membresía corta también la API |

### Pantallas

| Dónde | Qué |
|---|---|
| Barra lateral del portal | Selector de negocio en el bloque de la empresa, solo para quien es miembro de más de uno. Al cambiar, el portal vuelve al inicio con el negocio nuevo |
| CRM › Equipo (`/portal/crm/equipo`) | Alta, edición y baja (desactivar) del equipo comercial. Lo administra el titular |
| CRM › Servicios › Variables de la empresa (`/portal/crm/variables`) | Variables propias y los valores de las de ámbito empresa. Las de ámbito cliente se cargan en la ficha |
| Ficha del cliente | Closer, setter y responsable elegidos del equipo, y los datos propios de la empresa. El responsable anotado a mano se sigue viendo hasta que se elige a alguien |
| Bitácora (`/portal/bitacora`) | Solo titular. Movimientos de su empresa, lo que hizo FIRMA marcado, y «Verificar» para recalcular la cadena |

Los contratos del CRM completan también las variables propias: las de la empresa con su valor y las de cliente con la ficha. Una variable propia obligatoria sin valor frena el envío, como las del sistema.

Los avisos por mail de asuntos y documentos, y el firmante por defecto de la empresa, salen de las membresías: alguien que pertenece a dos negocios los recibe de los dos. El mail de los lunes todavía se arma con el negocio activo de cada persona.

Pendiente: que las funciones del servidor lean y escriban con el token del usuario en vez de la clave de servicio donde no necesitan saltear permisos (hoy validan el acceso con `acceso_vigente` y siguen usando la clave de servicio), y el mail de los lunes con varios negocios.
