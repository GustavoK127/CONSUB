# ConSub

O ConSub organiza inscrições em fila, consultas disponíveis e pedidos de consulta e transporte em uma única interface.

## Fluxos disponíveis

- Inscrição em fila associada a uma pessoa, especialidade e localidade.
- Consulta ao catálogo de horários, com filtros por especialidade e cidade.
- Registro de pedido de consulta e, opcionalmente, de transporte.
- Acesso às áreas conectadas por uma conta autenticada de operador.
- Cenários de organização da triagem e de faltas executados apenas no navegador.

Os registros pessoais devem ser sintéticos. A aplicação registra solicitações; não confirma agendamentos nem reserva ou reduz vagas e capacidade de transporte.

## Requisitos

- Node.js 20.14 ou superior.
- npm 10.7 ou superior.
- Projeto Supabase existente.

## Configuração local

Na raiz do repositório:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Edite `.env.local` com a URL do projeto e a chave pública de cliente. A chave `sb_publishable_...` fica no navegador por definição; não use a chave secreta `service_role`. As tabelas pessoais têm RLS e cada linha é vinculada à conta que a criou.

Inicie o site:

```powershell
npm run dev
```

Abra http://127.0.0.1:5173. A configuração Vite serve somente em localhost. Para gerar a versão compilada:

```powershell
npm run build
npm run preview
```

## Configuração do Supabase

A migração em `supabase/migrations` cria os catálogos, tabelas pessoais, validações, políticas RLS e duas operações transacionais. O arquivo `supabase/seed.sql` contém catálogos e horários sintéticos futuros. O seed pode ser executado novamente para restaurar os valores de capacidade do cenário.

Para vincular o CLI ao projeto e revisar a migração antes de enviá-la:

```powershell
npx supabase login
npx supabase link --project-ref vdcfodzxgbnvreewbehi
npx supabase db push --dry-run
```

Após revisar o resultado, aplique a migração e os dados do seed:

```powershell
npx supabase db push --include-seed
```

Não use `supabase db reset --linked`: esse comando apaga objetos do banco remoto. Docker não é necessário para enviar uma migração ao projeto hospedado. Ele só é necessário para iniciar a stack Supabase local.

A configuração remota de Auth fica no Dashboard do Supabase e não é alterada por `supabase/config.toml`. Em Authentication → Sign In / Providers, mantenha o provedor Email habilitado, desative “Allow new users to sign up” e mantenha “Allow anonymous sign-ins” desativado. Em Authentication → URL Configuration, use somente `http://127.0.0.1:5173` como Site URL e URL de retorno permitida. Crie uma única conta de operador pelo painel; a aplicação não oferece cadastro de contas.

## Dados e acesso

- Os catálogos de especialidade, cidade, unidade, profissional, consulta e capacidade são lidos por contas autenticadas.
- `pacientes`, `inscricoes_fila`, `solicitacoes_consulta` e `solicitacoes_transporte` usam RLS por `owner_id = auth.uid()`.
- O navegador não envia `owner_id`; o banco o associa à sessão autenticada.
- A inscrição de fila grava paciente e inscrição em uma operação atômica.
- O pedido de consulta e o pedido opcional de transporte são gravados juntos em uma operação atômica.
- Pedidos de consulta não criam agendamentos e não alteram o catálogo de vagas nem a capacidade de transporte.
- Os cenários de dengue e faltas permanecem no navegador e não gravam no banco.

## Estrutura principal

```text
.
├── docs/
│   ├── DER-ConSub.dot
│   ├── DER-ConSub.svg
│   └── Modelo-ER-ConSub.md
├── projetoVdd/
│   ├── acesso.html
│   ├── consultas.html
│   ├── entrar-fila.html
│   ├── supabase-app.js
│   └── supabase-client.js
└── supabase/
    ├── config.toml
    ├── migrations/
    └── seed.sql
```

## Documentação

O [modelo entidade-relacionamento](docs/Modelo-ER-ConSub.md) e o diagrama SVG descrevem as tabelas implementadas e suas relações.
