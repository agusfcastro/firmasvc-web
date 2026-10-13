-- Ejecutar UNA vez, después de crear tu usuario en Authentication › Users.
-- Reemplazá el mail si usás otro.
insert into public.perfiles (id, email, nombre, rol, activo)
select id, email, 'Agustín Castro', 'admin', true
from auth.users
where email = 'agustin@firmasvc.com'
on conflict (id) do update set rol = 'admin', activo = true;
