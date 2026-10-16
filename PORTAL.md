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
2. Redirect URLs agregá `https://firmasvc.com/portal/clave` y `http://localhost:3000/portal/clave`

## 4. Mails en español

El servidor de mails que trae Supabase manda muy pocos por hora y suele caer en spam. Antes de invitar clientes configurá uno propio en **Authentication › Emails › SMTP Settings**. Lo más simple es Resend (resend.com, plan gratis) con el dominio firmasvc.com verificado, o el SMTP de Google Workspace si usás Gmail con tu dominio.

Remitente sugerido `FIRMA <portal@firmasvc.com>`.

En **Authentication › Emails › Templates** reemplazá estas dos plantillas.

**Invite user**

Asunto `Tu acceso al portal de clientes de FIRMA`

```html
<p>Hola {{ .Data.nombre }}.</p>
<p>Te dimos acceso al portal de clientes de FIRMA. Desde ahí vas a encontrar los documentos, protocolos y materiales de formación de tu empresa.</p>
<p><a href="{{ .ConfirmationURL }}">Definir mi contraseña</a></p>
<p>El enlace vence en 24 horas y se usa una sola vez. Si no esperabas este mail, ignoralo.</p>
<p>FIRMA · Castro &amp; Partners</p>
```

**Reset password**

Asunto `Definí tu contraseña del portal FIRMA`

```html
<p>Hola.</p>
<p>Recibimos un pedido para definir la contraseña de tu cuenta en el portal de clientes de FIRMA.</p>
<p><a href="{{ .ConfirmationURL }}">Definir contraseña</a></p>
<p>Si no lo pediste vos, ignorá este mail. Tu contraseña actual sigue igual.</p>
<p>FIRMA · Castro &amp; Partners</p>
```

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
| `PORTAL_URL` | `https://firmasvc.com` |

**La clave service_role da control total sobre la base. Nunca la pongas con prefijo VITE_, ni en el código, ni en un chat.**

Después hacé un redeploy. Para probar en tu compu copiá `.env.example` como `.env.local` y completalo.

## 7. Uso diario

Entrá a `firmasvc.com/portal`.

1. **Clientes** para dar de alta cada empresa.
2. **Usuarios › Invitar usuario** con mail, nombre, rol, cliente y áreas. A la persona le llega el mail y define su contraseña.
3. Para cortar el acceso de alguien usá **Desactivar**. Queda bloqueado de inmediato y su historial se conserva.
4. Si alguien perdió el mail o la contraseña, **Reenviar acceso**.
5. **Registro de accesos** muestra quién ingresó y quién cambió permisos.

### Roles

| Rol | Qué ve |
|---|---|
| Admin FIRMA | Todo, de todos los clientes, y el panel de administración |
| Titular del cliente | Todo lo de su empresa y la lista de su equipo |
| Miembro del equipo | Lo de su empresa limitado a las áreas que le asignes |

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

Al dar de alta un cliente en el CRM se genera su contrato en ZapSign con el modelo del servicio. El link de firma queda en la ficha y en el listado, con un botón para copiarlo. Cuando el cliente firma, ZapSign avisa y el estado pasa a Firmado.

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
| `components/portal/crm/casos.ts` | Tipos, rótulos y cálculo de los indicadores |

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
