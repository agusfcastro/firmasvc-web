// Guion de cada tutorial. h trae ir, rotulo, apuntar, clic, escribir, elegir, desplazar, pausa y page.
const boton = (h, nombre) => h.page.getByRole('button', { name: nombre });
const pestana = (h, t) => h.page.locator('main button', { hasText: t }).first();
const tras = (h, rotulo, tag = 'input') => h.page.locator(`xpath=//*[normalize-space()="${rotulo}"]/following::${tag}[1]`).first();
const enlace = (h, nombre) => h.page.getByRole('link', { name: nombre });

export const GUIONES = {
  async inicio(h) {
    await h.ir('/portal');
    await h.rotulo('', 'Esta es la portada del portal de tu empresa.', 2800);
    await h.apuntar(boton(h, 'Inicio'));
    await h.rotulo('', 'Desde este menú vas a cualquier sección, estés donde estés.', 0);
    await h.clic(boton(h, 'Inicio'), 2200);
    await h.page.keyboard.press('Escape'); await h.pausa(600);
    await h.desplazar(430);
    await h.rotulo('', 'Tu expediente reúne todo lo que FIRMA trabaja con tu empresa.', 0);
    for (const t of ['CRM legal', 'Documentos', 'Firma electrónica', 'Agenda', 'Protocolos', 'Estado de asuntos']) {
      await h.apuntar(h.page.locator('main h3, main h2', { hasText: t }).first()); await h.pausa(500);
    }
    await h.desplazar(320);
    await h.apuntar(h.page.locator('main', { hasText: 'Abonos y pagos' }).getByText('Abonos y pagos').first());
    await h.rotulo('', 'Cada tarjeta te lleva a su sección. Arriba a la derecha está Salir.', 2800);
  },

  async crm(h) {
    await h.ir('/portal/crm');
    await h.rotulo('', 'El CRM legal muestra cada cliente con su contrato, la firma y las cuotas.', 3000);
    await h.apuntar(h.page.locator('.cifras').first());
    await h.rotulo('', 'Arriba ves los números del mes: firmados, pendientes, cobrado y por cobrar.', 3000);
    await h.desplazar(380);
    await h.rotulo('', 'Filtrá la lista con las pestañas.', 0);
    await h.clic(pestana(h, 'Vencidas'), 1600);
    await h.clic(pestana(h, 'Firma pendiente'), 1600);
    await h.clic(pestana(h, 'Todos'), 1400);
    await h.rotulo('', 'Cada fila muestra lo acordado, lo cobrado, la próxima cuota y el estado de la firma.', 0);
    await h.apuntar(enlace(h, 'Lucía Fernández')); await h.pausa(2200);
    await h.desplazar(-600, 1000);
    await h.rotulo('', 'Desde acá cargás un cliente nuevo o seguís los casos de conflicto.', 0);
    await h.apuntar(boton(h, 'Nuevo cliente')); await h.pausa(900);
    await h.apuntar(pestana(h, 'Casos de conflicto')); await h.pausa(2200);
  },

  async 'crm-alta'(h) {
    const p = h.page;
    await h.ir('/portal/crm');
    await h.rotulo('Paso 1', 'Tocá Nuevo cliente.', 1500);
    await h.clic(boton(h, 'Nuevo cliente'), 1500);
    await h.rotulo('Paso 2', 'Elegí si contrata una persona o una empresa y cargá sus datos.', 0);
    await h.clic(p.getByText('Contrata a título personal.'), 600);
    const campos = p.locator('main input:not([type=radio]), main select, main textarea');
    await h.escribir(campos.nth(0), 'Camila Rodríguez');
    await h.escribir(campos.nth(1), '38.456.789');
    await h.escribir(campos.nth(2), 'camila.rodriguez@ejemplo.com');
    await h.escribir(campos.nth(3), '+54 9 11 5555 0101');
    await h.escribir(campos.nth(4), 'Av. Corrientes 1234, CABA, Buenos Aires, Argentina');
    await h.rotulo('Paso 3', 'Elegí el servicio. El monto se completa con su precio y lo podés cambiar.', 0);
    await h.elegir(p.locator('main select').first(), { index: 1 });
    await h.apuntar(campos.nth(6)); await h.pausa(900);
    const onb = p.locator('main input[type=datetime-local]');
    await h.apuntar(onb); await onb.fill('2026-11-03T10:00'); await h.pausa(600);
    await h.escribir(campos.nth(8), 'Martina');
    await h.rotulo('Paso 4', 'Armá el plan de pagos: anticipo, cantidad de cuotas y primera fecha.', 0);
    await h.desplazar(420);
    const nums = p.locator('main input[type=number]');
    await h.escribir(nums.nth(1), '500');
    await nums.nth(2).fill(''); await h.escribir(nums.nth(2), '2');
    await p.locator('main input[type=date]').first().fill('2026-12-03'); await h.apuntar(p.locator('main input[type=date]').first()); await h.pausa(800);
    await h.rotulo('', 'El resumen te avisa si anticipo y cuotas suman exacto el total.', 2600);
    await h.rotulo('Paso 5', 'Si pactaron algo especial, escribilo. Se usa al armar el contrato.', 0);
    await h.escribir(p.locator('main textarea').first(), '10% off si paga el anticipo en 48 h.');
    await h.rotulo('Paso 6', 'Tocá Crear cliente. El contrato se arma solo y queda con la firma pendiente.', 0);
    await h.clic(boton(h, 'Crear cliente'), 4000);
    await h.rotulo('', 'Listo. Ya estás en la ficha del cliente nuevo.', 3000);
  },

  async 'crm-ficha'(h) {
    const p = h.page;
    await h.ir('/portal/crm');
    await h.rotulo('', 'Tocá un cliente para abrir su ficha.', 0);
    await h.clic(enlace(h, 'Lucía Fernández'), 1800);
    await h.rotulo('', 'Arriba ves el estado de la firma y el plan de pagos.', 2800);
    await h.desplazar(300);
    await h.rotulo('', 'Cuando entra un pago, marcá la cuota como pagada. Si te equivocaste, Deshacer.', 0);
    await h.clic(boton(h, 'Marcar pagada').first(), 1800);
    await h.clic(boton(h, 'Deshacer').last(), 1600);
    await h.apuntar(boton(h, 'Agregar cuota')); await h.apuntar(boton(h, 'Agregar anticipo'));
    await h.rotulo('', 'También podés sumar cuotas o anticipos.', 2200);
    await h.desplazar(520);
    await h.rotulo('', 'Si el cliente plantea un reclamo, abrí un caso de conflicto desde acá.', 0);
    await h.apuntar(boton(h, 'Abrir un caso')); await h.pausa(1800);
    await h.rotulo('', 'Los asuntos con FIRMA vinculados a este cliente aparecen debajo.', 2800);
    await h.desplazar(600);
    await h.rotulo('', 'En Datos del cliente corregís lo que haga falta y guardás.', 2800);
    await h.desplazar(900);
    await h.rotulo('', 'Al final están el contrato y el seguimiento de su firma.', 3000);
  },

  async casos(h) {
    const p = h.page;
    await h.ir('/portal/crm');
    await h.clic(pestana(h, 'Casos de conflicto'), 1600);
    await h.rotulo('', 'Casos de conflicto reúne los reclamos, reembolsos y contracargos.', 3000);
    await h.rotulo('', 'El tablero mide cómo funciona el protocolo: reclamos cada 100 ventas, tiempos y costos.', 0);
    await h.desplazar(320, 3200);
    await h.desplazar(420);
    await h.rotulo('', 'En el registro ves cada caso con su etapa, semáforo y días abierto.', 0);
    await h.desplazar(500, 1600);
    await h.clic(pestana(h, 'Cerrados'), 1400);
    await h.clic(pestana(h, 'Abiertos'), 1200);
    await h.rotulo('', 'Tocá un caso para ver el detalle y actualizarlo.', 0);
    await h.clic(boton(h, 'Valentina Castro').first(), 2400);
    await h.desplazar(400, 2400);
    await h.desplazar(-2000, 900);
    await h.rotulo('', 'Para registrar un reclamo nuevo, usá Nuevo caso.', 0);
    await h.apuntar(boton(h, 'Nuevo caso')); await h.pausa(2200);
  },

  async documentos(h) {
    await h.ir('/portal/documentos');
    await h.rotulo('', 'En Documentos están los modelos y contratos que FIRMA redactó para tu empresa.', 3000);
    await h.rotulo('', 'Se ordenan en tres grupos.', 0);
    await h.clic(enlace(h, /Contratos con tu equipo/), 1300);
    await h.clic(enlace(h, /Otros documentos/), 1300);
    await h.clic(enlace(h, /Contratos de servicio/), 1300);
    await h.rotulo('', 'Descargá el documento para usarlo.', 0);
    await h.apuntar(boton(h, 'Descargar').first()); await h.pausa(1800);
    await h.rotulo('', 'Si necesitás un cambio, pedí una adaptación y agendamos una reunión.', 0);
    await h.apuntar(enlace(h, 'Pedir adaptación').first()); await h.pausa(2400);
  },

  async protocolos(h) {
    await h.ir('/portal/protocolos');
    await h.rotulo('', 'Los protocolos explican cómo trabaja cada área de tu equipo, con respaldo legal.', 3200);
    await h.desplazar(380);
    await h.rotulo('', 'Cada uno se abre como página web, lista para compartir con tu equipo.', 0);
    await h.apuntar(boton(h, 'Abrir').or(enlace(h, 'Abrir')).first()); await h.pausa(2000);
    await h.rotulo('', 'Si tu operación es distinta, pedí la adaptación del protocolo.', 0);
    await h.apuntar(boton(h, 'Pedir adaptación').or(enlace(h, 'Pedir adaptación')).first()); await h.pausa(2000);
    await h.desplazar(600, 2400);
  },

  async firmas(h) {
    const p = h.page;
    await h.ir('/portal/firmas');
    await h.rotulo('', 'Firma electrónica: mandá un PDF a firmar y seguí quién firmó.', 2800);
    await h.rotulo('Paso 1', 'Tocá Nuevo envío.', 1200);
    await h.clic(enlace(h, 'Nuevo envío').first(), 1500);
    await h.rotulo('Paso 2', 'Subí el PDF y ponele un título.', 0);
    await h.apuntar(p.getByText('Arrastrá el PDF'));
    await p.locator('input[type=file]').setInputFiles('Contrato_Sofia_Ramirez.pdf'); await h.pausa(1500);
    const titulo = tras(h, 'Título');
    await titulo.fill(''); await h.escribir(titulo, 'Contrato de servicios · Sofía Ramírez');
    await h.escribir(p.locator('main textarea').first(), 'Hola Sofía, te dejo el contrato para que lo firmes.');
    await h.rotulo('Paso 3', 'Si es el contrato de un cliente del CRM, vinculalo. Al firmar, pasa solo a Firmado.', 0);
    const selCliente = p.locator('main select').nth(1);
    await h.elegir(selCliente, { label: 'Sofía Ramírez · DEM-003' });
    await h.desplazar(420);
    await h.rotulo('Paso 4', 'Al vincular el cliente, el firmante se completa solo. Con Sumar firmante agregás otros.', 0);
    await h.apuntar(tras(h, 'Nombre y apellido')); await h.pausa(1200);
    await h.apuntar(h.page.getByText('Sumar firmante')); await h.pausa(1600);
    await h.desplazar(380);
    await h.rotulo('Paso 5', 'Elegí cómo le llega: por mail con código, o copiando vos el enlace.', 0);
    await h.clic(p.getByText('Compartir el enlace', { exact: true }), 1200);
    await h.rotulo('Paso 6', 'Tocá el botón verde para crear el envío.', 0);
    await h.clic(boton(h, /Crear y copiar|Enviar a firmar/), 4000);
    await h.rotulo('', 'Listo. Desde acá copiás el enlace de cada firmante y seguís el estado de la firma.', 3600);
    await h.desplazar(400, 2400);
  },

  async asuntos(h) {
    const p = h.page;
    await h.ir('/portal/asuntos');
    await h.rotulo('', 'Estado de asuntos muestra los trámites con FIRMA y los conflictos de tu empresa.', 3000);
    await h.rotulo('', 'Cada asunto tiene su estado y el próximo paso.', 0);
    await h.clic(p.locator('a[href*="/portal/asuntos/"]', { hasText: 'A-DEM-001' }), 1800);
    await h.rotulo('', 'Adentro hablás con FIRMA por chat.', 0);
    const caja = p.locator('main textarea').first();
    await h.escribir(caja, '¿Necesitan algo más de nuestra parte para avanzar?');
    await h.clic(boton(h, /Enviar/).first(), 1800);
    await h.rotulo('', 'A la derecha ves el próximo paso y su vencimiento.', 2600);
    await h.rotulo('', 'En Bitácora queda el historial y en Documentos los archivos del asunto.', 0);
    await h.clic(pestana(h, 'Bitácora'), 1800);
    await h.clic(pestana(h, 'Documentos'), 1600);
    await h.clic(pestana(h, 'Chat'), 1000);
    await h.clic(enlace(h, /Estado de asuntos/i).first(), 1200);
    await h.rotulo('', 'Para un tema nuevo, tocá Nuevo asunto.', 0);
    await h.apuntar(boton(h, 'Nuevo asunto')); await h.pausa(2200);
  },

  async agenda(h) {
    await h.ir('/portal/agenda');
    await h.rotulo('', 'En Agenda reservás reuniones con FIRMA.', 2800);
    await h.rotulo('', 'Elegí el tipo de reunión y tocá Ver disponibilidad para elegir el horario.', 0);
    await h.apuntar(h.page.getByText('Ver disponibilidad').first()); await h.pausa(2400);
    await h.rotulo('', 'La invitación te llega por mail con el enlace de la videollamada.', 3000);
  },

  async pagos(h) {
    await h.ir('/portal/pagos');
    await h.rotulo('', 'En Pagos ves tu abono con FIRMA, el próximo débito y el historial.', 3000);
    await h.rotulo('', 'Cuando FIRMA prepara tu abono, aparece acá para aceptarlo y activarlo.', 2800);
    await h.desplazar(450);
    await h.rotulo('', 'Abajo comparás los planes y elegís el que te sirve.', 0);
    await h.desplazar(350, 2200);
    await h.apuntar(boton(h, /Quiero Black/).or(enlace(h, /Quiero Black/)).first()); await h.pausa(2200);
  },
};
