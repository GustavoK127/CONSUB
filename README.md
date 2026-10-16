# ConSub

O ConSub é um protótipo de site para conectar pessoas que aguardam atendimento no SUS a consultas que podem ficar disponíveis após cancelamentos ou faltas. A proposta é reduzir o desperdício de vagas e facilitar o acesso a consultas por especialidade e localidade.

## Funcionalidades demonstradas

- Página inicial com apresentação do serviço.
- Formulário de inscrição em fila, com dados de contato, especialidade médica e localização.
- Página de consultas disponíveis com busca e filtros por especialidade e cidade.
- Guia de funcionamento, critérios de prioridade e central de ajuda.
- Layout responsivo, com navegação para dispositivos móveis.

## Como visualizar

O projeto é feito com HTML, CSS e JavaScript, sem etapa de instalação ou compilação.

1. Clone ou baixe este repositório.
2. Abra `projetoVdd/index.html` no navegador.
3. Use o menu para acessar o formulário, as consultas disponíveis, o guia e a ajuda.

Também é possível servir a pasta `projetoVdd` com qualquer servidor HTTP estático.

## Estrutura

```text
.
├── docs/
│   ├── DER-ConSub.dot
│   ├── DER-ConSub.svg
│   └── Modelo-ER-ConSub.md
└── projetoVdd/
    ├── index.html
    ├── entrar-fila.html
    ├── consultas.html
    ├── como-funciona.html
    ├── ajuda.html
    ├── style.css
    ├── script.js
    └── bandeiraBrasil.webp
```

## Documentação

O [modelo entidade-relacionamento](docs/Modelo-ER-ConSub.md) descreve uma proposta de dados para inscrições, consultas, vagas, ofertas, notificações e agendamentos.

## Observação

Esta versão demonstra a interface e interações no navegador. Os formulários e ações de solicitação são simulados no front-end; o projeto não possui integração com sistemas do SUS, banco de dados, envio real de SMS ou agendamento efetivo.

## Licença

Nenhuma licença foi definida para este repositório.
