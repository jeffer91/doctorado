-- Doctorado ITSQMET · Base principal (Neon).
-- Nadie accede a estas tablas desde el navegador: solo la función "encuestas".
create extension if not exists pgcrypto;

create table if not exists public.doctorado_config (clave text primary key, valor text not null);
insert into public.doctorado_config (clave, valor)
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
  origen text not null default 'web' check (origen in ('web','respaldo')),
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


-- Código seudónimo estable por cédula (une etapas sin exponer la cédula).
create or replace function public.doctorado_preparar() returns trigger
language plpgsql as $$
begin
  new.codigo := substr(encode(sha256(convert_to(
    (select valor from public.doctorado_config where clave = 'sal') || new.cedula, 'UTF8')), 'hex'), 1, 12);
  return new;
end $$;

drop trigger if exists doctorado_preparar on public.doctorado_respuestas;
create trigger doctorado_preparar before insert on public.doctorado_respuestas
for each row execute function public.doctorado_preparar();

-- Administradores (contraseña con bcrypt), sesiones e intentos de acceso.
create table if not exists public.doctorado_admins (
  email text primary key check (email = lower(email)),
  clave_hash text not null
);
create table if not exists public.doctorado_sesiones (
  token_hash text primary key,
  email text not null references public.doctorado_admins(email) on delete cascade,
  expira timestamptz not null
);
create table if not exists public.doctorado_intentos (
  email text not null,
  momento timestamptz not null default now()
);
create index if not exists doctorado_intentos_idx on public.doctorado_intentos (email, momento);

-- Grupo de comparación: estudiantes sin la modalidad de artículo (examen o trabajo de titulación).
create table if not exists public.doctorado_regulares (
  id uuid primary key default gen_random_uuid(),
  cedula text not null unique check (cedula ~ '^[0-9]{10}$'),
  codigo text not null default '',
  version smallint not null default 1 check (version = 1),
  gusto smallint check (gusto between 1 and 5),
  eleccion text check (eleccion in ('examen','trabajo','articulo')),
  razon_si text check (razon_si in ('corto','investigar','publicar','carrera','aprender','no_elegiria','otra')),
  razon_si_otra text check (char_length(razon_si_otra) <= 200),
  razon_no text check (razon_no in ('preparacion','redaccion','tiempo','tema','examen','ninguna','otra')),
  razon_no_otra text check (char_length(razon_no_otra) <= 200),
  preparacion smallint check (preparacion between 1 and 5),
  formacion smallint check (formacion between 1 and 5),
  dificultad text check (dificultad in ('tema','bibliografia','metodologia','analisis','redaccion','tiempo','otra')),
  dificultad_otra text check (char_length(dificultad_otra) <= 200),
  apoyo text check (apoyo in ('metodologia','tutor','ejemplos','tiempo','talleres','otra')),
  apoyo_otra text check (char_length(apoyo_otra) <= 200),
  aporte_articulo smallint check (aporte_articulo between 1 and 5),
  aporte_examen smallint check (aporte_examen between 1 and 5),
  omitidas text[] not null default '{}',
  origen text not null default 'web' check (origen in ('web','respaldo')),
  created_at timestamptz not null default now(),
  constraint doctorado_reg_omitidas check (omitidas <@ array['gusto','eleccion','razon_si','razon_no','preparacion','formacion','dificultad','apoyo','aporte_articulo','aporte_examen']),
  constraint doctorado_reg_completa check (
        (gusto is not null) <> ('gusto' = any(omitidas))
    and (eleccion is not null) <> ('eleccion' = any(omitidas))
    and (razon_si is not null) <> ('razon_si' = any(omitidas))
    and (razon_no is not null) <> ('razon_no' = any(omitidas))
    and (preparacion is not null) <> ('preparacion' = any(omitidas))
    and (formacion is not null) <> ('formacion' = any(omitidas))
    and (dificultad is not null) <> ('dificultad' = any(omitidas))
    and (apoyo is not null) <> ('apoyo' = any(omitidas))
    and (aporte_articulo is not null) <> ('aporte_articulo' = any(omitidas))
    and (aporte_examen is not null) <> ('aporte_examen' = any(omitidas))
    and (razon_si_otra is null or razon_si = 'otra')
    and (razon_no_otra is null or razon_no = 'otra')
    and (dificultad_otra is null or dificultad = 'otra')
    and (apoyo_otra is null or apoyo = 'otra')
  )
);

drop trigger if exists doctorado_preparar on public.doctorado_regulares;
create trigger doctorado_preparar before insert on public.doctorado_regulares
for each row execute function public.doctorado_preparar();
