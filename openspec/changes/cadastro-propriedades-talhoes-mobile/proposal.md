# Proposal

## Why

O aplicativo mobile permite consultar propriedades e talhões, mas não permite cadastrá-los como na interface web. Quem trabalha pelo celular precisa criar os dois registros no backend e vê-los disponíveis nas listas e na seleção de atividades.

## What Changes

- Acrescentar ações e formulários de nova propriedade e novo talhão, seguindo a organização visual do mobile e os campos pertinentes dos formulários web.
- Cadastrar diretamente no backend existente, vinculando a propriedade à empresa da sessão e o talhão a uma propriedade da mesma empresa.
- Validar os dados, apresentar os resultados e atualizar listas e seletores; tratar falhas e resultados incertos sem criar duplicidades automaticamente.
- Informar que o cadastro depende de conexão, sem prometer sincronização offline para essas entidades.

## Capabilities

### New Capabilities

- `cadastros-rurais-mobile`: criação online de propriedades e talhões, validação, integração e atualização das consultas do mobile.

### Modified Capabilities

Nenhuma.

## Impact

- Mobile: telas de propriedades e talhões, formulários, cliente HTTP, carregamento de dados e testes.
- Backend existente: `POST /api/propriedades`, `POST /api/talhoes` e consultas de propriedades, talhões e cadastros auxiliares; sem alterações no backend.
- As rotas atuais não garantem autorização e isolamento de empresa no servidor. A filtragem mobile não é uma proteção suficiente; uso em produção depende da correção no backend.
- Não cria registros reais automaticamente: os dados concretos devem ser informados e confirmados pela pessoa usuária.
