# Modelo ER — ConSub

O modelo abaixo corresponde às tabelas da migração SQL. Os dados de catálogo e as capacidades iniciais vêm de `supabase/seed.sql`.

![Diagrama entidade-relacionamento do ConSub](DER-ConSub.svg)

## Entidades e relações

```mermaid
erDiagram
    especialidades ||--o{ consultas : classifica
    especialidades ||--o{ inscricoes_fila : solicitada_em
    cidades ||--o{ unidades_saude : possui
    cidades ||--o{ inscricoes_fila : localiza
    unidades_saude ||--o{ consultas : recebe
    unidades_saude o|--o{ inscricoes_fila : referencia
    profissionais_saude ||--o{ consultas : atende
    pacientes ||--o{ inscricoes_fila : realiza
    consultas ||--o{ solicitacoes_consulta : recebe
    solicitacoes_consulta ||--o| solicitacoes_transporte : pode_ter
    auth_users ||--o{ pacientes : owner_id
    auth_users ||--o{ inscricoes_fila : owner_id
    auth_users ||--o{ solicitacoes_consulta : owner_id
    auth_users ||--o{ solicitacoes_transporte : owner_id

    especialidades {
        uuid id PK
        text nome
        text slug
    }
    cidades {
        uuid id PK
        text nome
        char uf
        text slug
    }
    unidades_saude {
        uuid id PK
        uuid cidade_id FK
        text nome
        text tipo
    }
    profissionais_saude {
        uuid id PK
        text nome
    }
    consultas {
        uuid id PK
        uuid especialidade_id FK
        uuid unidade_id FK
        uuid profissional_id FK
        timestamptz data_hora
        integer vagas_disponiveis
        text urgencia
        text status
    }
    capacidade_transporte {
        date data PK
        integer capacidade
        integer ocupados
    }
    pacientes {
        uuid id PK
        uuid owner_id FK
        text nome_completo
        text cpf
        date data_nascimento
        text telefone
        text email
        text cns
        text telefone_responsavel
        timestamptz created_at
    }
    inscricoes_fila {
        uuid id PK
        uuid owner_id FK
        uuid paciente_id FK
        uuid especialidade_id FK
        uuid cidade_id FK
        uuid unidade_referencia_id FK
        text urgencia
        text descricao
        boolean aceite
        text status
        timestamptz created_at
    }
    solicitacoes_consulta {
        uuid id PK
        uuid owner_id FK
        uuid consulta_id FK
        text status
        timestamptz created_at
    }
    solicitacoes_transporte {
        uuid id PK
        uuid owner_id FK
        uuid solicitacao_consulta_id FK
        date data
        text ponto_embarque
        boolean area_rural
        text comunidade_rural
        integer passageiros
        timestamptz created_at
    }
    auth_users {
        uuid id PK
    }
```

## Acesso e integridade

- Todas as tabelas expostas têm RLS habilitada. O papel `anon` não recebe grants de leitura ou escrita.
- Os catálogos podem ser lidos por sessões autenticadas. Tabelas pessoais são limitadas a `owner_id = auth.uid()`.
- `owner_id` usa `auth.uid()` como valor padrão no banco e não é enviado pelo formulário.
- O índice parcial de `inscricoes_fila` impede duplicidade ativa para a mesma pessoa, especialidade, cidade e unidade de referência.
- As funções RPC salvam inscrição e pedido de consulta/transporte em operações atômicas.
- Um pedido de consulta não cria agendamento nem modifica `vagas_disponiveis` ou `capacidade_transporte.ocupados`.
- Os cenários de dengue e faltas não têm tabelas: continuam somente no navegador.

## Chaves

| Tabela | Chaves estrangeiras |
|---|---|
| `unidades_saude` | `cidade_id → cidades.id` |
| `consultas` | `especialidade_id → especialidades.id`; `unidade_id → unidades_saude.id`; `profissional_id → profissionais_saude.id` |
| `pacientes` | `owner_id → auth.users.id` |
| `inscricoes_fila` | `owner_id → auth.users.id`; `paciente_id → pacientes.id`; `especialidade_id → especialidades.id`; `cidade_id → cidades.id`; `unidade_referencia_id → unidades_saude.id` (opcional) |
| `solicitacoes_consulta` | `owner_id → auth.users.id`; `consulta_id → consultas.id` |
| `solicitacoes_transporte` | `owner_id → auth.users.id`; `solicitacao_consulta_id → solicitacoes_consulta.id` (única) |
