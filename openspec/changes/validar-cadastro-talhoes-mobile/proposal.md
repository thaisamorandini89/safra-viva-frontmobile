# Proposal

## Why

O mobile já possui a tela de cadastro de talhões e integração com o backend, mas a verificação completa com dados reais no dispositivo físico ainda está pendente. Além disso, o cartão de talhões da tela inicial não abre a lista e os registros existentes não podem ser editados pelo mobile.

## What Changes

- Revisar o formulário e a integração existentes com o contrato atual do backend; corrigir apenas divergências identificadas.
- Tornar o cartão **Talhões** da tela inicial clicável, levando à listagem existente.
- Permitir abrir um talhão da lista, carregar seus dados atuais, editar e salvar pelo backend, com ícones e rótulos claros.
- Validar o envio de propriedade, nome, código, área total e campos opcionais, bem como mensagens de sucesso e erro.
- Testar no dispositivo físico a criação de um talhão com dados e propriedade previamente confirmados pela usuária; verificar listagem e seletor de atividades sem criar atividade.
- Preservar a prevenção de duplicidade em caso de resultado incerto e registrar evidências sem credenciais ou informações sensíveis.

## Capabilities

### New Capabilities

- `verificacao-cadastro-talhoes-mobile`: verificação do fluxo de criação de talhões no mobile integrado ao backend existente.
- `edicao-talhoes-mobile`: acesso direto à listagem e edição online de talhões existentes.

### Modified Capabilities

Nenhuma especificação principal existente é alterada; o cadastro faz parte da mudança `cadastro-propriedades-talhoes-mobile` ainda em andamento.

## Impact

- Mobile: tela inicial, listagem, formulário de talhão, cliente HTTP, testes e documentação.
- Backend existente: `POST /api/talhoes`, `GET /api/talhoes`, `GET /api/talhoes/<id>`, `PUT /api/talhoes/<id>` e consultas auxiliares; não estão previstas alterações no backend nem no web.
- A operação é online. O backend analisado não demonstra autenticação ou isolamento por empresa nessas rotas; o filtro no mobile não substitui proteção no servidor.
- Não criar nem alterar registros reais até a usuária confirmar o registro e os dados de teste. Exclusão e troca de propriedade do talhão não fazem parte deste escopo.
