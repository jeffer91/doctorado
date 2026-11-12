-- Doctorado ITSQMET · Encuestas de titulación (base principal: Supabase)
-- Los estudiantes solo pueden INSERTAR. Solo el administrador puede LEER.

create schema if not exists doctorado_priv;
revoke all on schema doctorado_priv from public, anon, authenticated;

-- Correos con acceso de administrador.
create table if not exists doctorado_priv.admins (email text primary key);

-- Sal secreta para el código seudónimo longitudinal.
create table if not exists doctorado_priv.config (clave text primary key, valor text not null);
insert into doctorado_priv.config (clave, valor)
values ('sal', encode(sha256(convert_to(gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex'))
on conflict (clave) do nothing;

create table if not exists public.doctorado_respuestas (
  id uuid primary key default gen_random_uuid(),
  etapa text not null check (etapa in ('inicio','proceso','final')),
  cedula text not null check (cedula ~ '^[0-9]{10}$'),
  codigo text not null default '',
  version smallint not null default 1 check (version = 1),
  se1 smallint check (se1 between 1 and 5),
  se2 smallint check (se2 between 1 and 5),
  se3 smallint check (se3 between 1 and 5),
  se4 smallint check (se4 between 1 and 5),
  se5 smallint check (se5 between 1 and 5),
  p6 smallint check (p6 between 1 and 5),
  p7 smallint check (p7 between 1 and 5),
  horas numeric(4,1) check (horas >= 0 and horas <= 100),
  horas_ns boolean not null default false,
  dificultad text check (dificultad in ('tema','bibliografia','metodologia','analisis','redaccion','tiempo','tecnologia','otra')),
  dificultad_otra text check (char_length(dificultad_otra) <= 200),
  ia smallint check (ia between 1 and 5),
  omitidas text[] not null default '{}',
  origen text not null default 'web' check (origen in ('web','firebase')),
  created_at timestamptz not null default now(),
  constraint doctorado_una_por_etapa unique (etapa, cedula),
  constraint doctorado_omitidas_validas check (omitidas <@ array['se1','se2','se3','se4','se5','p6','p7','horas','dificultad','ia']),
  -- Cada pregunta tiene un valor o fue omitida expresamente (nunca ambas, nunca ninguna).
  constraint doctorado_completa check (
        (se1 is not null) <> ('se1' = any(omitidas))
    and (se2 is not null) <> ('se2' = any(omitidas))
    and (se3 is not null) <> ('se3' = any(omitidas))
    and (se4 is not null) <> ('se4' = any(omitidas))
    and (se5 is not null) <> ('se5' = any(omitidas))
    and (p6 is not null) <> ('p6' = any(omitidas))
    and (p7 is not null) <> ('p7' = any(omitidas))
    and (ia is not null) <> ('ia' = any(omitidas))
    and (dificultad is not null) <> ('dificultad' = any(omitidas))
    and ((horas is not null)::int + horas_ns::int + ('horas' = any(omitidas))::int) = 1
    and (dificultad_otra is null or dificultad = 'otra')
  )
);

create index if not exists doctorado_respuestas_fecha on public.doctorado_respuestas (created_at);

-- ¿La sesión actual es de un administrador con correo confirmado?
create or replace function doctorado_priv.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    join doctorado_priv.admins a on lower(a.email) = lower(u.email)
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  );
$$;

-- Completa el código seudónimo y protege los campos de control.
create or replace function doctorado_priv.preparar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not doctorado_priv.es_admin() then
    new.id := gen_random_uuid();
    new.created_at := now();
    new.origen := 'web';
  end if;
  new.codigo := substr(encode(sha256(convert_to(
    (select valor from doctorado_priv.config where clave = 'sal') || new.cedula, 'UTF8')), 'hex'), 1, 12);
  return new;
end $$;

revoke all on function doctorado_priv.es_admin() from public;
revoke all on function doctorado_priv.preparar() from public;
grant usage on schema doctorado_priv to authenticated;
grant execute on function doctorado_priv.es_admin() to authenticated;

drop trigger if exists doctorado_preparar on public.doctorado_respuestas;
create trigger doctorado_preparar before insert on public.doctorado_respuestas
for each row execute function doctorado_priv.preparar();

-- Permite al panel saber si la sesión tiene acceso.
create or replace function public.doctorado_soy_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select doctorado_priv.es_admin();
$$;
revoke all on function public.doctorado_soy_admin() from public, anon;
grant execute on function public.doctorado_soy_admin() to authenticated;

alter table public.doctorado_respuestas enable row level security;
alter table doctorado_priv.admins enable row level security;
alter table doctorado_priv.config enable row level security;

revoke all on public.doctorado_respuestas from anon, authenticated;
grant insert (etapa, cedula, version, se1, se2, se3, se4, se5, p6, p7, horas, horas_ns,
              dificultad, dificultad_otra, ia, omitidas)
  on public.doctorado_respuestas to anon, authenticated;
grant insert (origen, created_at) on public.doctorado_respuestas to authenticated;
grant select on public.doctorado_respuestas to authenticated;

drop policy if exists doctorado_enviar on public.doctorado_respuestas;
create policy doctorado_enviar on public.doctorado_respuestas
  for insert to anon with check (origen = 'web');

drop policy if exists doctorado_importar on public.doctorado_respuestas;
create policy doctorado_importar on public.doctorado_respuestas
  for insert to authenticated with check (origen = 'web' or (select doctorado_priv.es_admin()));

drop policy if exists doctorado_leer on public.doctorado_respuestas;
create policy doctorado_leer on public.doctorado_respuestas
  for select to authenticated using ((select doctorado_priv.es_admin()));
-- Sin políticas de UPDATE ni DELETE: el registro original no se modifica.
