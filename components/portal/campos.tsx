import React from 'react';
import { I18nProvider } from 'react-aria-components';
import { parseDate, parseDateTime, type DateValue } from '@internationalized/date';
import { Calendar, DateField, DatePicker, Header, ListBox, Select, ToggleButton, ToggleButtonGroup } from '@heroui/react';

/**
 * Campos de HeroUI que reemplazan a los nativos del portal sin cambiar cómo se usan.
 *
 *   <Selector>  en lugar de <select>. Recibe los mismos <option> y <optgroup> como hijos y llama a
 *               onChange con { target: { value } }, así el cambio es renombrar la etiqueta.
 *   <Fecha>     en lugar de <input type="date"> o "datetime-local", con calendario en español y
 *               la fecha en dd/mm/aaaa. Devuelve el mismo texto que el input nativo.
 *   <Opciones>  botones de una sola elección (Lista o Kanban, Archivo o Enlace), con ToggleButtonGroup.
 *
 * Las casillas y las opciones redondas siguen siendo nativas, con el aspecto de HeroUI desde
 * index.css («Casillas y opciones con el aspecto de HeroUI»).
 */

/* ------------------------------------------------------------------ */
/* Selector                                                            */
/* ------------------------------------------------------------------ */

interface OpcionNativa {
  valor: string;
  texto: string;
  deshabilitada: boolean;
}
interface GrupoNativo {
  titulo: string | null;
  opciones: OpcionNativa[];
}

/** RAC no acepta una clave vacía: el «Sin asignar» con valor '' viaja con esta. */
const VACIO = '__vacio__';

function textoDe(n: React.ReactNode): string {
  if (n == null || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(textoDe).join('');
  if (React.isValidElement(n)) return textoDe((n.props as { children?: React.ReactNode }).children);
  return '';
}

/** Lee los <option> y <optgroup> de los hijos, con fragmentos y listas adentro. */
function leerOpciones(hijos: React.ReactNode): GrupoNativo[] {
  const grupos: GrupoNativo[] = [{ titulo: null, opciones: [] }];
  const visitar = (n: React.ReactNode, grupo: GrupoNativo) => {
    React.Children.forEach(n, (c) => {
      if (!React.isValidElement(c)) return;
      const p = c.props as { children?: React.ReactNode; value?: string | number; disabled?: boolean; label?: string };
      if (c.type === React.Fragment) visitar(p.children, grupo);
      else if (c.type === 'option') grupo.opciones.push({ valor: p.value != null ? String(p.value) : textoDe(p.children), texto: textoDe(p.children), deshabilitada: Boolean(p.disabled) });
      else if (c.type === 'optgroup') {
        const nuevo: GrupoNativo = { titulo: String(p.label ?? ''), opciones: [] };
        grupos.push(nuevo);
        visitar(p.children, nuevo);
      }
    });
  };
  visitar(hijos, grupos[0]);
  return grupos.filter((g) => g.opciones.length > 0);
}

/** De las clases que traía el <select> quedan solo las de tamaño y ubicación; el resto lo pone HeroUI. */
const DE_UBICACION = /^!?(w-|min-w-|max-w-|flex|self-|shrink|grow|basis-|order-|col-|row-|m[trblxy]?-|-m[trblxy]?-|hidden|block|inline|(tab|desk|wide|sm|md|lg):)/;
const soloUbicacion = (clases: string) =>
  clases
    .split(/\s+/)
    .filter((c) => DE_UBICACION.test(c))
    .join(' ');

export interface PropsSelector {
  value: string | number;
  onChange?: (e: { target: { value: string } }) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  /** Lo que se ve si el valor no está entre las opciones. */
  placeholder?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-invalid'?: boolean;
}

export const Selector: React.FC<PropsSelector> = ({ value, onChange, children, className = '', disabled, required, id, name, placeholder, ...aria }) => {
  const grupos = leerOpciones(children);
  const clave = (v: string) => (v === '' ? VACIO : v);
  const actual = String(value ?? '');
  // Con «required», vacío no cuenta como elección, como en el <select>, así frena el envío; se ve el
  // texto de la opción vacía («Elegí»). Sin «required», la opción vacía («Todos», «Sin asignar») es una
  // elección más y se ve como tal.
  const textoVacio = grupos.flatMap((g) => g.opciones).find((o) => o.valor === '')?.texto;
  const seleccion = actual === '' ? (required || textoVacio === undefined ? null : VACIO) : actual;
  // Sin ancho propio, el <select> medía lo que su texto; acá queda con un mínimo y crece con el texto.
  const ubicacion = soloUbicacion(className);
  const conAncho = /(^|\s)!?(w-|min-w-|basis-|flex-1)/.test(ubicacion);
  const items = (g: GrupoNativo) =>
    g.opciones.map((o) => (
      <ListBox.Item key={clave(o.valor)} id={clave(o.valor)} textValue={o.texto} isDisabled={o.deshabilitada}>
        {o.texto}
        <ListBox.ItemIndicator />
      </ListBox.Item>
    ));
  return (
    <Select
      value={seleccion}
      onChange={(k) => onChange?.({ target: { value: k == null || k === VACIO ? '' : String(k) } })}
      isDisabled={disabled}
      isRequired={required}
      isInvalid={aria['aria-invalid'] || undefined}
      id={id}
      name={name}
      placeholder={placeholder ?? textoVacio ?? 'Elegí'}
      aria-label={aria['aria-label']}
      aria-labelledby={aria['aria-labelledby']}
      className={`selector ${conAncho ? '' : 'selector--auto'} ${ubicacion}`}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {grupos.map((g, i) =>
            g.titulo === null ? (
              <React.Fragment key={`g-${i}`}>{items(g)}</React.Fragment>
            ) : (
              <ListBox.Section key={`g-${i}`}>
                <Header>{g.titulo}</Header>
                {items(g)}
              </ListBox.Section>
            ),
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
};

/* ------------------------------------------------------------------ */
/* Fecha                                                               */
/* ------------------------------------------------------------------ */

const leerFecha = (v: string | undefined, conHora: boolean): DateValue | null => {
  if (!v) return null;
  try {
    return conHora ? parseDateTime(v.slice(0, 16)) : parseDate(v.slice(0, 10));
  } catch {
    return null;
  }
};

export interface PropsFecha {
  type?: 'date' | 'datetime-local';
  value: string;
  onChange?: (e: { target: { value: string } }) => void;
  min?: string;
  max?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-invalid'?: boolean;
}

/**
 * La fecha en dd/mm/aaaa y, con type="datetime-local", la hora en 24 horas. El valor entra y sale
 * como el del input nativo: AAAA-MM-DD o AAAA-MM-DDTHH:mm, y vacío si se borra.
 */
export const Fecha: React.FC<PropsFecha> = ({ type = 'date', value, onChange, min, max, className = '', disabled, required, id, name, ...aria }) => {
  const conHora = type === 'datetime-local';
  return (
    <I18nProvider locale="es-AR">
      <DatePicker
        value={leerFecha(value, conHora)}
        onChange={(v) => onChange?.({ target: { value: v ? (conHora ? v.toString().slice(0, 16) : v.toString().slice(0, 10)) : '' } })}
        granularity={conHora ? 'minute' : 'day'}
        hourCycle={24}
        minValue={leerFecha(min, conHora) ?? undefined}
        maxValue={leerFecha(max, conHora) ?? undefined}
        isDisabled={disabled}
        isRequired={required}
        isInvalid={aria['aria-invalid'] || undefined}
        id={id}
        name={name}
        aria-label={aria['aria-label']}
        aria-labelledby={aria['aria-labelledby']}
        className={`fecha ${/(^|\s)!?(w-|min-w-|basis-|flex-1)/.test(soloUbicacion(className)) ? '' : 'w-full'} ${soloUbicacion(className)}`}
      >
        <DateField.Group>
          <DateField.Input>{(segmento) => <DateField.Segment segment={segmento} />}</DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger aria-label="Abrir el calendario">
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DatePicker.Popover>
          <Calendar aria-label="Elegí la fecha">
            <Calendar.Header>
              <Calendar.Heading />
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>{(dia) => <Calendar.HeaderCell>{dia}</Calendar.HeaderCell>}</Calendar.GridHeader>
              <Calendar.GridBody>{(fecha) => <Calendar.Cell date={fecha} />}</Calendar.GridBody>
            </Calendar.Grid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
    </I18nProvider>
  );
};

/* ------------------------------------------------------------------ */
/* Opciones                                                            */
/* ------------------------------------------------------------------ */

/** Botones pegados para elegir una sola opción, como Lista o Línea de tiempo en Clientes. */
export function Opciones<T extends string>({ valor, alCambiar, opciones, etiqueta, deshabilitado, className = '' }: { valor: T; alCambiar: (v: NoInfer<T>) => void; opciones: { valor: NoInfer<T>; texto: React.ReactNode }[]; etiqueta: string; deshabilitado?: boolean; className?: string }) {
  return (
    <ToggleButtonGroup
      aria-label={etiqueta}
      selectionMode="single"
      disallowEmptySelection
      isDisabled={deshabilitado}
      selectedKeys={new Set([valor])}
      onSelectionChange={(k) => {
        const v = [...k][0];
        if (v != null) alCambiar(String(v) as T);
      }}
      className={className}
    >
      {opciones.map((o, i) => (
        <ToggleButton key={o.valor} id={o.valor}>
          {i > 0 && <ToggleButtonGroup.Separator />}
          {o.texto}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
