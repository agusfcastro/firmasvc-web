# Fase 1 · Prompts para Claude Code

Pegá cada prompt en una sesión de Claude Code abierta en el repositorio, en este orden. No pases al siguiente hasta cumplir el criterio de terminado. Si una sesión se alarga, cerrala y abrí otra, porque `CLAUDE.md` le da todo el contexto de nuevo.

Antes de empezar, copiá `CLAUDE.md` a la raíz del repo y la carpeta `docs/` completa.

---

## 0. Reconocimiento del repo

```
Leé CLAUDE.md y los archivos de docs/. Después recorré el repositorio y el esquema de Supabase y escribí docs/ESTADO_ACTUAL.md con la estructura de carpetas, cómo está resuelto el backend (rutas /api de Vercel o Edge Functions de Supabase), las tablas existentes con sus políticas RLS, cómo funcionan hoy los roles, qué secciones del portal existen y en qué estado parecen estar, qué servicio de mail se usa y qué variables de entorno hay (solo nombres, nunca valores).

No cambies código en esta tarea. Al final, listame las dudas que tengas antes de construir a Tina.
```

**Terminado cuando** existe `docs/ESTADO_ACTUAL.md` y respondiste sus dudas.

---

## 1. Esquema de datos de Tina

```
Con CLAUDE.md y docs/ESTADO_ACTUAL.md como base, proponé y después creá las migraciones de Supabase para Tina. Reutilizá las tablas que ya existen para clientes, usuarios y casos en lugar de duplicarlas.

Necesito guardar
- conversaciones y mensajes de Tina, con el camino elegido, tokens de entrada y salida y costo estimado en USD por mensaje
- tickets de derivación, con prioridad, categoría, resumen, estado, responsable y vencimiento
- fichas de cierre, con los datos en jsonb, campos faltantes y estado (borrador, en revisión, validada, rechazada)
- eventos del cliente para el resumen diario (onboarding, reagendamiento, caso, conflicto, firma, cuota), con fecha, responsable y una marca de avisar al responsable
- recursos precargados (SOP, mensaje modelo, video, cláusula), con el plan mínimo que los ve
- suscripciones a notificaciones push por usuario
- en la ficha del cliente, el plan, la zona horaria y el teléfono del responsable

Toda tabla con datos de clientes lleva RLS por client_id. El rol admin ve todo. Las fichas validadas no se pueden editar desde roles de cliente.

Mostrame el plan antes de crear las migraciones.
```

**Terminado cuando** las migraciones corren en limpio y una prueba con dos clientes confirma que ninguno ve datos del otro.

---

## 2. Backend de Tina

```
Construí el endpoint de chat de Tina siguiendo el patrón de backend del repo.

1. Verificá la sesión del usuario y cargá su cliente, plan y rol.
2. Armá el prompt de sistema desde docs/TINA_SYSTEM_PROMPT.md, con la parte estática primero para usar el cacheo de prompts de la API y el contexto del cliente después.
3. Llamá a la API de Claude con streaming y con las herramientas buscar_recurso, consultar_contrato, crear_ficha_cierre, registrar_evento y crear_ticket. Verificá en docs.claude.com el modelo recomendado actual y la sintaxis vigente de herramientas y cacheo antes de escribir el código.
4. Ejecutá cada herramienta en el servidor verificando permisos. crear_ticket solo existe para clientes Eminent, y esa regla se valida en el código, no solo en el prompt.
5. Guardá cada mensaje con tokens y costo.
6. La clave de la API vive solo en variables de entorno del servidor.

Cuando un ticket es de prioridad alta, mandale un mail y una notificación push al admin.
```

**Terminado cuando** podés conversar con Tina desde un cliente de prueba, los mensajes quedan guardados con su costo y un cliente Starter no puede crear tickets aunque lo pida.

---

## 3. Burbuja de chat

```
Construí la burbuja de chat de Tina para el portal. Botón flotante abajo a la derecha, panel que se abre encima del contenido y pantalla completa en el celular. Mostrá la respuesta a medida que llega, un indicador de que Tina está escribiendo y el historial de la conversación. Cuando Tina crea una ficha, mostrala como tarjeta con un botón de confirmar. Estética negra del portal, accesible y en español rioplatense.
```

**Terminado cuando** funciona en desktop, Android y iPhone, y un usuario nuevo entiende cómo usarla sin explicación.

---

## 4. Bandeja de admin

```
Construí una bandeja para el rol admin con dos pestañas. Tickets, ordenados por prioridad y vencimiento, con la conversación de origen y botones para tomar, responder y cerrar. Fichas de cierre, con los datos, los campos faltantes y botones para validar o rechazar con un comentario. Validar una ficha solo cambia su estado, la generación del contrato sigue siendo el flujo manual que ya existe.
```

**Terminado cuando** podés procesar un ticket y una ficha de punta a punta sin salir de la bandeja.

---

## 5. Avisos al responsable

```
En las pantallas donde se actualizan asuntos y conflictos, agregá una opción para avisar al responsable. Si se marca, se crea un evento y se manda una notificación push al responsable. Cada evento de onboarding nuevo avisa solo al account manager del cliente. Ninguna notificación lleva contenido promocional.
```

**Terminado cuando** marcar la opción genera exactamente una notificación al usuario correcto.

---

## 6. Portal instalable

```
Convertí el portal en una PWA instalable. Manifest con nombre FIRMA, logo de FIRMA y colores del portal, service worker con caché básica y notificaciones push con VAPID. Agregá al onboarding una pantalla que detecte el dispositivo y explique cómo instalar la app, con el paso de agregar a la pantalla de inicio en iPhone, que es obligatorio para recibir notificaciones ahí.
```

**Terminado cuando** la app se instala en Android y iPhone y recibe una notificación de prueba en ambos.

---

## 7. Resumen diario

```
Construí el resumen diario. Un proceso programado corre cada hora y, para cada cliente cuya hora local sean las 7 de la mañana de lunes a viernes, junta los eventos del día y los casos abiertos, le pide a Tina un resumen breve en su tono y lo manda por mail al titular y a los account managers, con el mismo servicio que usa la firma electrónica. Incluí un botón que abre el chat de Tina. Si no hay novedades, mandá un mensaje corto que lo avise. Para redactar el resumen usá el modelo más económico disponible, verificado en docs.claude.com. Registrá cada envío y su costo.
```

**Terminado cuando** un cliente de prueba recibe cinco resúmenes correctos en días hábiles seguidos, a las 7 en su hora local.

---

## 8. Home por plan

```
Rediseñá la pantalla de inicio del portal según el plan. Arriba, una o dos acciones pendientes del usuario. Debajo, el acceso a Tina. El resto de las secciones en segundo plano. En Starter, mostrá los módulos de Eminent bloqueados, con una línea que explique qué ganarían.
```

**Terminado cuando** un cliente de cada plan ve su home correcta y entiende qué hacer primero.

---

## 9. Batería de prueba

```
Escribí un script que corra los casos de docs/TINA_BATERIA.md contra el endpoint de Tina, una vez con un cliente Eminent de prueba y otra con un cliente Starter, y que genere docs/RESULTADO_BATERIA.md con el camino esperado, el camino obtenido, la respuesta y si pasó. Incluí las cinco pruebas de seguridad.
```

**Terminado cuando** pasan al menos 20 de 21 casos en cada plan, las cinco pruebas de seguridad y ninguna interpretación legal sale sin derivación en Eminent.

---

## 10. Costos

```
Agregá al panel de admin una vista con el costo de Tina por cliente y por mes, sumando chat y resúmenes diarios, y el total general. Marcá en rojo a cualquier cliente cuyo costo supere el 10% de lo que paga por mes.
```

**Terminado cuando** ves el costo real de la semana de prueba por cliente.
