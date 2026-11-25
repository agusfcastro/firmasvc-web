-- =====================================================================
-- Calidad de la IA (migración 0075): cada corrida queda con su empresa
-- aunque el servidor no la mande, y la llamada descifrada de un análisis
-- la lee solo el servidor, para armar casos de prueba.
-- =====================================================================

insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial, email) values
  ('e0000000-0000-0000-0000-0000000000c5', 'aaaaaaaa-0000-0000-0000-000000000000', 'Closer de A', 'closer', 'closer@a.test');
insert into public.interacciones (id, organizacion_id, equipo_miembro_id, fuente, externo_id, titulo, ocurrida_en, duracion_seg,
                                  participantes, contenido_cifrado, contenido_sha256, retener_contenido_hasta)
values ('1a000000-0000-0000-0000-0000000000c5', 'aaaaaaaa-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-0000000000c5',
        'fathom', 'rec-calidad', 'Venta de prueba', now() - interval '1 hour', 900, '{"equipo": ["e0000000-0000-0000-0000-0000000000c5"]}',
        pgp_sym_encrypt('{"transcripcion": [{"hablante": "Prospecto", "email": "p@x.test", "segundo": 5, "texto": "Quiero la garantía"}]}',
                        public.crm_clave('interacciones_contenido'), 'cipher-algo=aes256'),
        'sha', now() + interval '90 days');
insert into public.interaccion_analisis (id, organizacion_id, interaccion_id, version) values
  ('a1000000-0000-0000-0000-0000000000c5', 'aaaaaaaa-0000-0000-0000-000000000000', '1a000000-0000-0000-0000-0000000000c5', 'venta-1.1');
insert into public.asuntos (id, organizacion_id, titulo, tipo) values
  ('a7000000-0000-0000-0000-0000000000c5', 'bbbbbbbb-0000-0000-0000-000000000000', 'Contrato de B', 'contrato');
insert into public.asunto_archivos (id, asunto_id, organizacion_id, nombre, ruta) values
  ('f7000000-0000-0000-0000-0000000000c5', 'a7000000-0000-0000-0000-0000000000c5', 'bbbbbbbb-0000-0000-0000-000000000000', 'contrato.docx',
   'bbbbbbbb-0000-0000-0000-000000000000/a7000000-0000-0000-0000-0000000000c5/1.docx');

-- El servidor anota sin la empresa y la base la completa desde el registro original.
select pruebas.como_servicio();
insert into public.ia_corridas (agente, version_prompt, referencia_tabla, referencia_id) values
  ('analisis_venta', 'v1', 'interaccion_analisis', 'a1000000-0000-0000-0000-0000000000c5'),
  ('borradores_comentarios', 'v1', 'asunto_archivos', 'f7000000-0000-0000-0000-0000000000c5'),
  ('tina', 'v1', 'tina_conversaciones', 'no-es-un-uuid'),
  ('tina', 'v1', 'tina_conversaciones', '00000000-0000-0000-0000-00000000dead');
insert into public.ia_corridas (agente, version_prompt, organizacion_id, referencia_tabla, referencia_id) values
  ('analisis_venta', 'v1', 'bbbbbbbb-0000-0000-0000-000000000000', 'interaccion_analisis', 'a1000000-0000-0000-0000-0000000000c5');
select pruebas.como_postgres();
select pruebas.ok((select organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' from public.ia_corridas
                   where agente = 'analisis_venta' and version_prompt = 'v1' order by id limit 1), 'la corrida del analizador toma la empresa del análisis');
select pruebas.ok((select organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000' from public.ia_corridas
                   where agente = 'borradores_comentarios'), 'la de los borradores, la del archivo');
select pruebas.ok((select count(*) = 2 from public.ia_corridas where agente = 'tina' and organizacion_id is null),
                  'una referencia que no es un id o que no existe queda sin empresa y no falla');
select pruebas.ok((select organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000' from public.ia_corridas
                   where agente = 'analisis_venta' and version_prompt = 'v1' order by id desc limit 1), 'la empresa que manda el servidor no se pisa');

-- La llamada descifrada la lee solo el servidor.
select pruebas.como_servicio();
select pruebas.ok((select public.ia_contenido_analisis('a1000000-0000-0000-0000-0000000000c5') -> 'contenido' -> 'transcripcion' -> 0 ->> 'texto'
                   = 'Quiero la garantía'), 'el servidor lee la llamada de un análisis');
select pruebas.ok((select public.ia_contenido_analisis('a1000000-0000-0000-0000-0000000000c5') -> 'equipo' -> 0 ->> 'email' = 'closer@a.test'), 'con el equipo, para separar roles');
select pruebas.ok((select public.ia_contenido_analisis('a1000000-0000-0000-0000-0000000000c5') -> 'resultado' ->> 'estado' = 'pendiente'), 'y con lo que resolvió el analizador');
select pruebas.ok(public.ia_contenido_analisis('00000000-0000-0000-0000-00000000dead') is null, 'un análisis que no existe no devuelve nada');

select pruebas.como_postgres();
update public.interacciones set retener_contenido_hasta = now() - interval '1 day' where id = '1a000000-0000-0000-0000-0000000000c5';
select pruebas.como_servicio();
select pruebas.ok((select (public.ia_contenido_analisis('a1000000-0000-0000-0000-0000000000c5') ->> 'sin_contenido')::boolean),
                  'pasado el plazo de guardado ya no hay llamada');

select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
do $$
begin
  perform public.ia_contenido_analisis('a1000000-0000-0000-0000-0000000000c5');
  raise exception 'FALLÓ: el portal leyó la llamada descifrada';
exception when insufficient_privilege then null;
end $$;
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$
begin
  perform public.ia_contenido_analisis('a1000000-0000-0000-0000-0000000000c5');
  raise exception 'FALLÓ: un titular leyó la llamada descifrada';
exception when insufficient_privilege then null;
end $$;
