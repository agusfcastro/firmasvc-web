-- =====================================================================
-- Duración de cada servicio (migración 0079).
-- =====================================================================

create function pruebas.falla(consulta text, espera text) returns void language plpgsql as $$
begin
  begin
    execute consulta;
  exception when others then
    if sqlerrm not ilike '%' || espera || '%' then
      raise exception 'FALLÓ: se esperaba «%» y salió «%»', espera, sqlerrm;
    end if;
    return;
  end;
  raise exception 'FALLÓ: tenía que rechazarse: %', consulta;
end;
$$;

insert into public.crm_servicios (organizacion_id, clave, nombre, duracion_meses) values ('aaaaaaaa-0000-0000-0000-000000000000', 'PRUEBA6', 'Seis meses', 6);
select pruebas.ok((select duracion_meses from public.crm_servicios where clave = 'PRUEBA6') = 6, 'un servicio guarda su duración en meses');
select pruebas.falla($q$insert into public.crm_servicios (organizacion_id, clave, nombre, duracion_meses) values ('aaaaaaaa-0000-0000-0000-000000000000', 'MAL', 'Cero', 0)$q$, 'duracion_meses');
select pruebas.falla($q$update public.crm_servicios set duracion_meses = 61 where clave = 'PRUEBA6'$q$, 'duracion_meses');
insert into public.crm_servicios (organizacion_id, clave, nombre) values ('aaaaaaaa-0000-0000-0000-000000000000', 'SINPLAZO', 'Sin plazo');
select pruebas.ok((select duracion_meses is null from public.crm_servicios where clave = 'SINPLAZO'), 'la duración es opcional');
