# Auditoría de calidad percibida

Este protocolo mide si el portal y la web de FIRMA se sienten un producto premium o uno más hecho con IA. Sale del video de Tim Gabe (ver Fuente) y se corre sin gastar en la API de Claude.

La tesis del video es que hoy cualquiera arma pantallas prolijas en un día con IA, y por eso todas se parecen. Eso pone un techo a lo que se puede cobrar, que él llama techo de commodity. El cerebro no tiene un detector de premium, pero suma en silencio cada prueba de que el producto está bien hecho.

Lindo y premium no son lo mismo. Lo lindo hace que te elijan y la evidencia de calidad hace que te consideren premium. Esa evidencia vive en tres lugares, y cada uno es una capa de esta auditoría.

1. **Lo que la IA deja afuera.** Mostrar qué está pasando, dejar deshacer y ayudar a salir de un error.
2. **Un solo producto.** Que la pantalla 80 coincida con la pantalla 1.
3. **El peor momento.** Que una falla bien resuelta deje al usuario igual o mejor que antes.

Para FIRMA pesa doble. El cliente confía documentos, firmas y dinero, y lo que se vende con Eminent es justamente que alguien cuida esos detalles.

## Cuándo se corre y sobre qué

Hay tres pasadas, de menor a mayor. Los tiempos son estimados.

| Pasada | Cuándo | Qué cubre | Tiempo |
| --- | --- | --- | --- |
| Corta | Antes de unir a main un PR que suma o cambia una pantalla o un flujo | Las tres capas, solo sobre lo que tocó el PR | 15 minutos |
| Completa | Una vez por mes y antes de cerrar el rediseño de fin de 2026 | Las tres capas sobre todos los flujos núcleo | Medio día |
| Por incidente | Cuando un cliente se queja, pregunta por WhatsApp algo que el portal debía resolver o aparece un conflicto atado al portal | El flujo donde pasó, empezando por la capa 3 | 1 hora |

Los flujos núcleo, en orden de prioridad.

1. Ingresar, con segundo factor y definir clave.
2. Firmar un documento, por mail y por enlace. Es lo que mejor funciona hoy y no se puede romper.
3. Cargar una venta en el CRM y mandar el contrato a firma.
4. Pagar el abono con dLocal Go, cambiar el medio de pago y ver un débito rechazado.
5. Responder un asunto y comentar un documento.
6. Pedir un contrato.
7. Equipo, cargar una victoria con evidencia, validarla y armar un reporte.
8. Instalar la app y recibir un aviso, por push y en la campana.
9. Web pública, home, `/landing`, Planes y agenda.

Cada flujo se recorre con cada rol que lo usa (`admin`, `titular`, account manager, `closer` y `setter`), en celular y en computadora. Siempre con empresas y cuentas de prueba, nunca con datos de un cliente real.

## Cómo corre la pasada corta una sesión de Claude

1. Listá las pantallas y los flujos que toca el PR.
2. En cada acción tocada, respondé las tres preguntas de la capa 1 y revisá los ocho estados de su tabla.
3. Contrastá lo nuevo con los patrones compartidos de la capa 2 (componente, vocabulario, formato, tokens).
4. Si el PR toca un peor momento de la capa 3, recorré su fila de la tabla y las cinco cosas que tiene que cumplir.
5. Recorré la vista previa del PR en Vercel con el navegador, con cuentas de prueba, en tamaño celular y computadora.
6. Sumá a la descripción del PR una sección Auditoría de calidad con el resultado por capa y cada hallazgo con su gravedad.
7. Un hallazgo crítico frena la unión a main hasta que se arregla.

## Capa 1. Lo que la IA deja afuera

Las herramientas de IA explican sus decisiones de diseño con mucha seguridad, pero parte de ese razonamiento nunca llega a la pantalla. Según el video, lo que se saltean es lo menos vistoso, como mostrar qué hace el sistema, dejar deshacer y ayudar a salir de un error. Los investigadores lo llamaron teatro de diseño, y lo paga el usuario con esfuerzo mental.

En cada acción del flujo se responden tres preguntas.

1. **¿Sabe qué acaba de pasar?** El botón responde al instante, se deshabilita mientras trabaja y al terminar dice qué pasó con el dato concreto. «Contrato enviado a firma a Juan Pérez, vence el 3 de diciembre» y no «Listo».
2. **¿Puede volver atrás?** Lo que se puede revertir se deshace, no se confirma. La confirmación queda para lo irreversible y nombra qué se pierde.
3. **¿Sabe qué hacer después?** Cada final de flujo ofrece el paso siguiente en la misma pantalla.

Y una regla que sale del caso Undertone del video. El usuario nunca recibe nada como resultado. Si algo no cuenta, no se guardó o no alcanza, la pantalla dice por qué y qué hacer.

Cada pantalla tiene que tener diseñados estos estados, y no dejarlos librados a lo que salga por defecto.

| Estado | Qué tiene que mostrar |
| --- | --- |
| Cargando | Que algo está pasando, sin saltos cuando llegan los datos |
| Vacío por primera vez | Qué va a aparecer ahí y el botón para cargar lo primero |
| Vacío por filtro o búsqueda | Que no hay resultados con ese filtro y cómo limpiarlo |
| Con datos | El caso feliz, el único que suele revisarse |
| Error | Qué pasó en castellano llano, qué hacer y un botón para reintentar |
| Sin permiso | Por qué no lo ve y a quién pedírselo |
| Sin conexión | Que se cortó, qué quedó guardado y cómo se reintenta |
| Parcial | Qué parte cargó y cuál falta |

**Ejercicio.** Recorré el flujo y anotá, acción por acción, las tres respuestas. Según el video, ese acompañamiento solo ya lleva muy lejos.

## Capa 2. Que se sienta un solo producto

El equipo revisa una pantalla por vez, pero el usuario vive con la pantalla 80 al lado de la 1. Con IA el problema crece, porque un agente arma una pantalla nueva en un minuto y es fácil terminar con 80 que no coinciden entre sí.

El video cita un estudio de la Universidad de York de 2009. A mitad de una tarea movieron la barra de navegación de la izquierda a la derecha, el tiempo en esa página se duplicó con creces y la lentitud siguió en las páginas siguientes. La mayoría notó el cambio y aun así creyó que no la había frenado. O sea, esta inconsistencia cuesta más de lo que el usuario dice y de lo que muestran los datos.

Qué se revisa.

- **Un mismo caso, un mismo patrón.** Cada situación que se repite tiene un solo componente. Vacío, límite del plan alcanzado, vencimiento, error, confirmar un borrado, éxito al guardar y sin permiso.
- **Límites con número y fecha.** Es el arreglo de Undertone, que unificó dos pantallas distintas de sesiones agotadas en una sola con el contador, una línea que lo explica y la fecha en que se renuevan. En FIRMA ya está resuelto para firmas y agenda con `BarraUso`, y sirve de vara para cualquier límite nuevo, como las 10 llamadas analizadas de Starter.
- **Navegación quieta.** La barra lateral, la barra inferior del celular y la acción principal de cada encabezado están siempre en el mismo lugar.
- **Mismo vocabulario.** Un solo nombre para cada cosa en todo el portal, con los roles estándar (Account Manager y no CSM) mostrados siempre con `rolDe()`.
- **Mismos datos, mismo formato.** Fechas, montos y monedas salen siempre de las mismas piezas (`Monto`, `simboloMoneda()`) y los estados siempre con `Etiqueta`.
- **Mismos colores.** Solo tokens, con `npm run marca:verificar` en verde.
- **Mismo mensaje en todos los canales.** El mail, el push, la campana, el PDF y el portal cuentan lo mismo con las mismas palabras.

**Ejercicio.** Usá el portal una hora como lo usaría un cliente real, con una cuenta por rol, y anotá cada lugar donde deja de sentirse el mismo producto.

## Capa 3. El peor momento

Una falla bien resuelta puede dejar al usuario igual o más contento que si nada hubiera pasado. Se llama paradoja de la recuperación del servicio, y el video cita una revisión grande de 2007 que lo respalda. El ejemplo clásico es el dinosaurio de Chrome, que convirtió una página muerta en un juego.

Al revés también pesa. Según una encuesta de 2018 que cita el video, una sola mala experiencia alcanza para que cerca de un tercio de la gente abandone. Y es justo donde peor les va a las herramientas de IA, porque resolverlo bien exige usar el producto, probarlo y romperlo.

El caso del video que más se parece a FIRMA es el de una tarjeta cripto. La gente le confiaba su dinero y ante un pago fallido no tenía ninguna información. El arreglo fue una alerta que pide revisar el saldo, con el botón de contactar a soporte ahí mismo. Junto con otros cambios, las cuentas nuevas crecieron 60% y el dinero cargado 79%.

Los peores momentos del portal, por gravedad.

| Momento | Qué tiene que pasar |
| --- | --- |
| Débito o pago rechazado en dLocal Go | Decir qué pasó y si el servicio sigue, con «Cambiar medio de pago» y el contacto con FIRMA en la misma alerta |
| Firma que falla (enlace vencido, mail que no llega, error de sellado, firmante equivocado) | Reenviar o corregir desde ahí, sin tocar el registro de auditoría, y avisar a quien mandó a firmar |
| Sesión vencida en un formulario largo (alta en el CRM, pedido de contrato) | Volver a ingresar sin perder lo escrito |
| Sin conexión a mitad de un envío | Decir si se mandó o no, nunca dejarlo en duda, y no duplicarlo al reintentar |
| Archivo que no sube (evidencia de una victoria, documento pesado o de formato raro) | Decir el límite y el formato aceptado antes de que falle, y conservar el resto del formulario |
| Aviso que no llega | Que quede siempre en la campana, llegue o no el push |
| Dato repetido o en conflicto | Avisar antes de guardar con el enlace a lo que ya existe, como ya hace el CRM con los nombres repetidos |

Toda respuesta a un peor momento cumple cinco cosas.

1. Dice qué pasó en palabras llanas.
2. Dice si el dinero, el documento o la firma están a salvo.
3. Ofrece la acción concreta en el mismo lugar, con un botón.
4. Ofrece a una persona de FIRMA por el canal que el cliente ya usa, que hoy es WhatsApp.
5. Conserva lo que el usuario ya hizo y le avisa al responsable.

**Ejercicio. Romperlo a propósito.** Cortá el wifi a mitad de un flujo, hacé fallar un pago en el sandbox de dLocal Go, vaciá cada lista, dejá vencer la sesión, subí un archivo pesado o de formato inválido, abrí un enlace de firma vencido, entrá con un rol sin permiso, tocá dos veces enviar y volvé atrás con el navegador a mitad de un formulario. Después diseñá esos estados con el mismo cuidado que las pantallas de éxito. Según el video, como casi nadie lo hace, es de los lugares más baratos para ganar sensación de calidad.

## Cómo se registra

Cada hallazgo va en una fila con el flujo, el rol, el dispositivo, la capa, lo que ve hoy el usuario, lo que debería ver, la gravedad y una captura.

| Gravedad | Cuándo | Qué se hace |
| --- | --- | --- |
| Crítica | Se puede perder dinero, un documento o una firma, o el usuario queda sin saber qué hacer en un peor momento | Se arregla antes de unir a main |
| Alta | Rompe la sensación de un solo producto en un flujo núcleo u obliga al cliente a preguntar por WhatsApp | Entra en la semana |
| Media | Inconsistencia visible fuera de un flujo núcleo | Entra en el mes |
| Baja | Detalle de texto o visual | Se junta y se arregla en tanda |

Cada flujo cierra la pasada con un resultado por capa, que es pasa, pasa con observaciones o no pasa. Un hallazgo crítico hace que esa capa no pase, aunque todo lo demás esté bien. La pasada completa se compara con la del mes anterior, para ver si el portal sube o baja.

## Reglas al arreglar

- Antes de implementar un cambio visual, se muestran capturas de cómo va a quedar y se espera la aprobación de Agustín.
- Un patrón repetido se arregla en el componente compartido, no pantalla por pantalla. Si el componente no existe, se crea primero.
- Cambios chicos y verificables, como pide `CLAUDE.md`.
- No se rompe lo que ya funciona, en especial la firma electrónica con su registro de auditoría.
- Los textos nuevos van en rioplatense, con voseo y con los roles estándar.
- La auditoría no llama a la API de Claude. Se hace a mano o con Claude recorriendo el portal en el navegador.

## Primera pasada sobre el portal, al 26 de noviembre de 2026

Son indicios sacados del código para saber por dónde arrancar, no la auditoría hecha. Cada uno se confirma recorriendo la pantalla, y la fila se borra o se actualiza cuando se resuelve.

| Capa | Qué hay hoy | Lectura |
| --- | --- | --- |
| 2 | Firmas y Agenda ya muestran el cupo con lo usado, lo incluido y el día en que se renueva (`BarraUso`) | Es el arreglo de Undertone ya resuelto. Falta para las llamadas analizadas cuando el analizador esté validado |
| 3 | Los errores de Supabase se traducen a castellano en un solo lugar (`mensajeAmable` en `components/portal/errores.ts`) | Buena base. Falta que cada caso sume el paso siguiente y un botón, no solo el texto |
| 3 | El aviso de sin conexión vive en `Marco` (`useConexion` en `components/portal/ui.tsx`) | Bien. Falta probar qué pasa con un envío cortado a la mitad |
| 3 | El CRM avisa del nombre repetido antes de guardar, con el enlace a la ficha que ya existe | Es el modelo a copiar en los demás peores momentos |
| 1 | La ficha del CRM ya ofrece Deshacer (`components/portal/crm/Ficha.tsx`) | Es el patrón a extender a las otras acciones reversibles |
| 2 | Hay 30 confirmaciones con el cuadro nativo del navegador (`window.confirm`) | Se ven distintas al resto del portal y no ofrecen deshacer. Candidato a un componente propio y, donde se pueda revertir, a Deshacer |
| 2 | Hay unos 50 textos de vacío («Todavía no…», «No hay…») escritos pantalla por pantalla, sin un componente compartido | Riesgo directo de pantallas que no coinciden |
| 1 | `Cargando` aparece en 5 de las 65 pantallas | Revisar cómo muestran la carga las otras 60 |
| 1 | Unos 10 archivos muestran un estado explícito de guardado | Revisar qué ve el usuario después de guardar en el resto |

## Fuente

- [The Psychology of Premium Apps](https://www.youtube.com/watch?v=8EAYZe6y3I8), de Tim Gabe, publicado el 15 de octubre de 2026. El protocolo sale de su transcripción.
- Los estudios y las cifras (York 2009, la revisión de 2007, la encuesta de 2018, la investigación de 2026 sobre cinco herramientas de IA y los resultados de sus clientes) son los que cita el video. No se verificaron por separado.
