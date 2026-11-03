-- El estado de la firma del cliente lo llevan sus envíos a firma electrónica.
-- Al mandarlo a firmar pasa solo a «En firma». Si el envío se rechaza, vence o
-- se anula, vuelve a «Pendiente», salvo que tenga otro envío en curso. Al
-- completarse lo pasa a «Firmado» la función de firma (api/firma/firmar.ts).

alter table public.crm_clientes drop constraint if exists crm_clientes_estado_firma_check;
alter table public.crm_clientes add constraint crm_clientes_estado_firma_check
  check (estado_firma in ('Pendiente', 'En firma', 'Firmado', 'Baja'));

create or replace function public.firma_sobres_estado_crm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.crm_cliente_id is null then
    return new;
  end if;
  if new.estado = 'en_curso' and (tg_op = 'INSERT' or old.estado is distinct from 'en_curso') then
    update crm_clientes set estado_firma = 'En firma'
      where id = new.crm_cliente_id and estado_firma = 'Pendiente';
  elsif tg_op = 'UPDATE' and old.estado = 'en_curso' and new.estado in ('rechazado', 'vencido', 'anulado') then
    update crm_clientes set estado_firma = 'Pendiente'
      where id = new.crm_cliente_id and estado_firma = 'En firma'
        and not exists (
          select 1 from firma_sobres s
          where s.crm_cliente_id = new.crm_cliente_id and s.estado = 'en_curso' and s.id <> new.id
        );
  end if;
  return new;
end;
$$;

drop trigger if exists firma_sobres_estado_crm on public.firma_sobres;
create trigger firma_sobres_estado_crm
  after insert or update of estado on public.firma_sobres
  for each row execute function public.firma_sobres_estado_crm();

-- Los que ya están en firma hoy.
update public.crm_clientes c set estado_firma = 'En firma'
  where c.estado_firma = 'Pendiente'
    and exists (select 1 from public.firma_sobres s where s.crm_cliente_id = c.id and s.estado = 'en_curso');
