-- =====================================================================
-- FIRMA · Portal · Firma por enlace compartido
-- Un envío puede salir por mail, como hasta ahora, o por enlace: no se
-- mandan invitaciones, quien envía copia el enlace de cada firmante y se
-- lo pasa (por ejemplo en el onboarding) y se firma sin código por mail.
-- La constancia del PDF firmado dice cómo se entregó el enlace.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

alter table public.firma_sobres add column if not exists entrega text not null default 'mail';

alter table public.firma_sobres drop constraint if exists firma_sobres_entrega;
alter table public.firma_sobres add constraint firma_sobres_entrega check (entrega in ('mail', 'enlace'));
