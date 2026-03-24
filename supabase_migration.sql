-- ============================================================
-- SISTEMA DE GESTÃO DE VENDAS E PRONTUÁRIOS
-- Migration SQL para Supabase
-- Execute no SQL Editor do Supabase (https://supabase.com/dashboard)
-- ============================================================

-- ============================
-- 1. CLIENTES
-- ============================
create table if not exists public.clientes (
  id bigint generated always as identity primary key,
  nome text not null,
  cpf text unique,
  email text,
  telefone text,
  data_nascimento date,
  endereco text,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists clientes_nome_idx on public.clientes (nome);
create index if not exists clientes_cpf_idx on public.clientes (cpf);

-- ============================
-- 2. SERVICOS (serviços e produtos)
-- ============================
create table if not exists public.servicos (
  id bigint generated always as identity primary key,
  nome text not null,
  descricao text,
  tipo text not null default 'servico'
    check (tipo in ('servico', 'produto')),
  preco numeric(10,2) not null check (preco >= 0),
  ativo boolean default true,
  created_at timestamptz default now()
);

create index if not exists servicos_tipo_idx on public.servicos (tipo);
create index if not exists servicos_ativo_idx on public.servicos (ativo) where ativo = true;

-- ============================
-- 3. VENDAS
-- ============================
create table if not exists public.vendas (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes(id) on delete restrict,
  data_venda date not null default current_date,
  valor_total numeric(10,2) not null default 0 check (valor_total >= 0),
  status text not null default 'pendente'
    check (status in ('pendente', 'pago', 'cancelado')),
  forma_pagamento text,
  observacoes text,
  created_at timestamptz default now()
);

create index if not exists vendas_cliente_id_idx on public.vendas (cliente_id);
create index if not exists vendas_data_venda_idx on public.vendas (data_venda);
create index if not exists vendas_status_idx on public.vendas (status);

-- ============================
-- 4. ITENS_VENDA
-- ============================
create table if not exists public.itens_venda (
  id bigint generated always as identity primary key,
  venda_id bigint not null references public.vendas(id) on delete cascade,
  servico_id bigint not null references public.servicos(id) on delete restrict,
  quantidade integer not null default 1 check (quantidade > 0),
  preco_unitario numeric(10,2) not null check (preco_unitario >= 0),
  subtotal numeric(10,2) generated always as (quantidade * preco_unitario) stored
);

create index if not exists itens_venda_venda_id_idx on public.itens_venda (venda_id);
create index if not exists itens_venda_servico_id_idx on public.itens_venda (servico_id);

-- ============================
-- 5. PRONTUARIOS
-- ============================
create table if not exists public.prontuarios (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes(id) on delete restrict,
  venda_id bigint references public.vendas(id) on delete set null,
  data_atendimento date not null default current_date,
  descricao text not null,
  receita text,
  prescricao text,
  profissional text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists prontuarios_cliente_id_idx on public.prontuarios (cliente_id);
create index if not exists prontuarios_venda_id_idx on public.prontuarios (venda_id);
create index if not exists prontuarios_data_idx on public.prontuarios (data_atendimento);

-- ============================
-- 6. DOCUMENTOS (anexos)
-- ============================
create table if not exists public.documentos (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes(id) on delete cascade,
  prontuario_id bigint references public.prontuarios(id) on delete set null,
  nome_arquivo text not null,
  tipo_documento text,
  url_arquivo text not null,
  created_at timestamptz default now()
);

create index if not exists documentos_cliente_id_idx on public.documentos (cliente_id);
create index if not exists documentos_prontuario_id_idx on public.documentos (prontuario_id);

-- ============================
-- 7. TRIGGER — auto-update updated_at
-- ============================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clientes_updated_at
  before update on public.clientes
  for each row execute function public.update_updated_at();

create trigger prontuarios_updated_at
  before update on public.prontuarios
  for each row execute function public.update_updated_at();

-- ============================
-- 8. ROW LEVEL SECURITY
-- ============================
alter table public.clientes enable row level security;
alter table public.servicos enable row level security;
alter table public.vendas enable row level security;
alter table public.itens_venda enable row level security;
alter table public.prontuarios enable row level security;
alter table public.documentos enable row level security;

-- Usuários autenticados (equipe interna) têm acesso total
create policy "Authenticated full access" on public.clientes
  for all to authenticated using (true) with check (true);

create policy "Authenticated full access" on public.servicos
  for all to authenticated using (true) with check (true);

create policy "Authenticated full access" on public.vendas
  for all to authenticated using (true) with check (true);

create policy "Authenticated full access" on public.itens_venda
  for all to authenticated using (true) with check (true);

create policy "Authenticated full access" on public.prontuarios
  for all to authenticated using (true) with check (true);

create policy "Authenticated full access" on public.documentos
  for all to authenticated using (true) with check (true);

-- ============================
-- 9. VIEWS — Dashboard / KPIs
-- ============================

-- Faturamento mensal
create or replace view public.v_faturamento_mensal as
select
  date_trunc('month', v.data_venda) as mes,
  count(distinct v.id) as total_vendas,
  count(distinct v.cliente_id) as total_clientes,
  coalesce(sum(v.valor_total), 0) as faturamento
from public.vendas v
where v.status != 'cancelado'
group by date_trunc('month', v.data_venda)
order by mes desc;

-- Faturamento por serviço/produto
create or replace view public.v_faturamento_por_servico as
select
  s.id as servico_id,
  s.nome,
  s.tipo,
  count(iv.id) as qtd_vendida,
  coalesce(sum(iv.subtotal), 0) as total_faturado
from public.itens_venda iv
join public.servicos s on s.id = iv.servico_id
join public.vendas v on v.id = iv.venda_id
where v.status != 'cancelado'
group by s.id, s.nome, s.tipo
order by total_faturado desc;

-- Últimos atendimentos
create or replace view public.v_ultimos_atendimentos as
select
  c.id as cliente_id,
  c.nome as cliente_nome,
  p.id as prontuario_id,
  p.data_atendimento,
  p.descricao,
  p.profissional,
  v.valor_total,
  v.status as venda_status
from public.prontuarios p
join public.clientes c on c.id = p.cliente_id
left join public.vendas v on v.id = p.venda_id
order by p.data_atendimento desc;

-- ============================
-- 10. DADOS DE EXEMPLO (opcional)
-- ============================

-- Serviços de exemplo
insert into public.servicos (nome, descricao, tipo, preco) values
  ('Consulta Inicial', 'Primeira consulta de avaliação', 'servico', 250.00),
  ('Retorno', 'Consulta de retorno', 'servico', 150.00),
  ('Sessão Terapêutica', 'Sessão com duração de 50 minutos', 'servico', 300.00),
  ('Exame Clínico', 'Avaliação clínica completa', 'servico', 450.00),
  ('Produto A', 'Suplemento vitamínico', 'produto', 89.90),
  ('Produto B', 'Hidratante dermatológico', 'produto', 120.00);


-- Multi-tenant migration
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE public.itens_venda ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE public.prontuarios ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

DROP POLICY IF EXISTS "Authenticated full access" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated full access" ON public.servicos;
DROP POLICY IF EXISTS "Authenticated full access" ON public.vendas;
DROP POLICY IF EXISTS "Authenticated full access" ON public.itens_venda;
DROP POLICY IF EXISTS "Authenticated full access" ON public.prontuarios;
DROP POLICY IF EXISTS "Authenticated full access" ON public.documentos;

CREATE POLICY "user_isolated_policy" ON public.clientes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_isolated_policy" ON public.servicos FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_isolated_policy" ON public.vendas FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_isolated_policy" ON public.itens_venda FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_isolated_policy" ON public.prontuarios FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_isolated_policy" ON public.documentos FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP VIEW IF EXISTS public.v_faturamento_mensal;
CREATE VIEW public.v_faturamento_mensal WITH (security_invoker = true) AS SELECT date_trunc('month', v.data_venda) as mes, count(distinct v.id) as total_vendas, count(distinct v.cliente_id) as total_clientes, coalesce(sum(v.valor_total), 0) as faturamento FROM public.vendas v WHERE v.status != 'cancelado' GROUP BY date_trunc('month', v.data_venda) ORDER BY mes desc;
DROP VIEW IF EXISTS public.v_faturamento_por_servico;
CREATE VIEW public.v_faturamento_por_servico WITH (security_invoker = true) AS SELECT s.id as servico_id, s.nome, s.tipo, count(iv.id) as qtd_vendida, coalesce(sum(iv.subtotal), 0) as total_faturado FROM public.itens_venda iv JOIN public.servicos s ON s.id = iv.servico_id JOIN public.vendas v ON v.id = iv.venda_id WHERE v.status != 'cancelado' GROUP BY s.id, s.nome, s.tipo ORDER BY total_faturado desc;
DROP VIEW IF EXISTS public.v_ultimos_atendimentos;
CREATE VIEW public.v_ultimos_atendimentos WITH (security_invoker = true) AS SELECT c.id as cliente_id, c.nome as cliente_nome, p.id as prontuario_id, p.data_atendimento, p.descricao, p.profissional, v.valor_total, v.status as venda_status FROM public.prontuarios p JOIN public.clientes c ON c.id = p.cliente_id LEFT JOIN public.vendas v ON v.id = p.venda_id ORDER BY p.data_atendimento desc;



-- Multi-tenant migration V2 (RBAC/Admin)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade unique,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz default now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS \$\$ BEGIN RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'); END; \$\$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.clientes;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.servicos;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.vendas;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.itens_venda;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.prontuarios;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.documentos;

CREATE POLICY "tenant_isolation_policy" ON public.clientes FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_admin()) WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "tenant_isolation_policy" ON public.servicos FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_admin()) WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "tenant_isolation_policy" ON public.vendas FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_admin()) WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "tenant_isolation_policy" ON public.itens_venda FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_admin()) WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "tenant_isolation_policy" ON public.prontuarios FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_admin()) WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "tenant_isolation_policy" ON public.documentos FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_admin()) WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS \$\$ BEGIN IF NEW.email = 'kauekurosaki@gmail.com' THEN INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'); ELSE INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user'); END IF; RETURN NEW; END; \$\$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

