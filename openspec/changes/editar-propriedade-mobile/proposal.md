# Proposal

## Why

A lista mobile apresenta as propriedades, mas seus cartões não abrem o registro. Para corrigir informações, a pessoa precisa sair do aplicativo. Ações com ícones acompanhados de texto tornam o fluxo mais fácil de entender.

## What Changes

- Permitir tocar em uma propriedade da lista para abrir seus dados atuais, editar e salvar no backend existente.
- Reaproveitar o formulário de propriedade e a busca de CEP, preservando a criação e evitando apagar dados que não foram alterados.
- Atualizar a lista e as opções relacionadas após salvar, com mensagens claras para validação, falhas e resultado incerto.
- Adicionar ícones intuitivos e acessíveis, acompanhados de texto, aos cartões e botões do fluxo de propriedades, como criar, editar, buscar CEP, salvar e voltar.

## Capabilities

### New Capabilities

- `edicao-propriedade-mobile`: abertura, edição e atualização online de propriedade existente, com ações visuais acessíveis.

### Modified Capabilities

Nenhuma especificação principal existente é alterada; os cadastros e a consulta de CEP ainda pertencem a mudanças OpenSpec em andamento.

## Impact

- Mobile: lista de propriedades, formulário existente, cliente HTTP, componentes visuais e testes.
- Backend existente: `GET /api/propriedades/<id>` e `PUT /api/propriedades/<id>`, além dos catálogos já usados; sem alterações no backend ou web.
- As rotas analisadas não demonstram autenticação ou isolamento por empresa no servidor. A verificação no mobile reduz erros de uso, mas não garante segurança; produção depende de proteção no backend.
- A edição é online e não cria uma fila offline. Testes automatizados não alteram registros reais; o teste em dispositivo que salvar dados depende de autorização explícita.
