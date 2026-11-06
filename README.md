# ConSub

O ConSub organiza inscrições em fila, consultas disponíveis e pedidos de consulta e transporte em uma única interface.

## Fluxos disponíveis

- Inscrição em fila associada a uma pessoa, especialidade e localidade.
- Consulta ao catálogo de horários, com filtros por especialidade e cidade.
- Registro de pedido de consulta e, opcionalmente, de transporte.
- Cadastro público com e-mail, senha e confirmação do endereço.
- Área do usuário para editar o próprio perfil e acompanhar/cancelar inscrições e pedidos.
- Painel do operador para consultar, editar, mudar status e excluir registros de qualquer usuário.
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

Edite `.env.local` com a URL do projeto e a chave pública de cliente. A chave `sb_publishable_...` fica no navegador por definição; não use a chave secreta `service_role`. As tabelas pessoais têm RLS e cada linha é vinculada à conta que a criou. Se `.env.local` já estiver configurado, preserve o arquivo existente.

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

As migrações em `supabase/migrations` criam os catálogos, tabelas pessoais, papéis protegidos, políticas RLS e operações transacionais. A primeira migração foi preservada; a segunda promove a única conta Auth inicial a operador e atribui automaticamente o papel `user` às contas criadas depois dela.

O projeto remoto existente já recebeu as duas migrações. Para usá-lo no dia a dia basta `npm run dev`; não repita migrações ou seeds ao iniciar o site. O arquivo `supabase/seed.sql` contém os catálogos e horários sintéticos. Reaplicá-lo restaura os valores de vagas e capacidade do cenário.

Para conferir o histórico por uma CLI autenticada e vinculada:

```powershell
npx supabase login
npx supabase link --project-ref vdcfodzxgbnvreewbehi
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

Não use `supabase db reset --linked`: esse comando apaga objetos do banco remoto. Docker não é necessário para enviar uma migração ao projeto hospedado. Ele só é necessário para iniciar a stack Supabase local.

A configuração remota de Auth fica no Dashboard do Supabase e não é alterada por `supabase/config.toml`:

- Email habilitado; “Allow new users to sign up” e “Confirm email” ligados.
- “Allow anonymous sign-ins” desligado.
- Site URL: `http://127.0.0.1:5173`.
- Redirect URLs: `http://127.0.0.1:5173` e `http://127.0.0.1:5173/conta.html`.

O SMTP padrão do Supabase envia somente para endereços de membros da equipe do projeto e atualmente limita o projeto a 2 e-mails por hora. Por isso o cadastro está disponível, mas a confirmação de um endereço externo à equipe depende de adicionar esse endereço à equipe ou configurar SMTP próprio. Não foi configurado SMTP externo. Consulte a [documentação oficial de SMTP](https://supabase.com/docs/guides/auth/auth-smtp) e os [limites de autenticação](https://supabase.com/docs/guides/auth/rate-limits).

Os três pacientes sintéticos e três inscrições do operador foram preservados. `supabase/seed_operator_demo_data.sql` é o seed histórico executado antes do cadastro público; não o use para criar usuários Auth. Em outro projeto vazio, aplique a primeira migração e o catálogo, mantenha os cadastros desativados, crie exatamente uma conta Auth inicial e só então aplique a segunda migração antes de habilitar cadastros.

`supabase/operations/reconcile_public_user_roles_history.sql` registra a segunda migração no histórico quando ela já foi aplicada pelo SQL Editor. Essa operação foi executada no projeto existente; não substitui a aplicação de uma migração em um banco novo.

## Dados e acesso

- Os catálogos de especialidade, cidade, unidade, profissional, consulta e capacidade são lidos por contas autenticadas.
- Usuários leem apenas seus próprios registros nas quatro tabelas pessoais. Edição do perfil e cancelamentos próprios passam por funções que verificam a conta no servidor.
- `user_roles` e `perfis_usuarios` não têm acesso direto para clientes. Papéis não são lidos de `user_metadata`.
- Cada usuário tem um único perfil de paciente; os três pacientes históricos do operador são preservados como exceção existente.
- Operadores podem administrar os registros de todas as contas, mas não criam registros em nome de usuários nem administram contas Auth pela aplicação.
- Triggers impedem transferir `owner_id`, inclusive por operadores.
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
    ├── seed.sql
    └── seed_operator_demo_data.sql
```

## Documentação

O [modelo entidade-relacionamento](docs/Modelo-ER-ConSub.md) e o diagrama SVG descrevem as tabelas da integração inicial. As migrações SQL são a referência atual para os papéis e as políticas de acesso.

Consulte [a validação de acesso](docs/Validacao-acessos.md) para os resultados, o roteiro SQL reproduzível e a limitação pendente da confirmação por e-mail.
