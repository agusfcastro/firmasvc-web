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
