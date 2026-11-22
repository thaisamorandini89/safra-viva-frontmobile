# Atalho e edição de talhões mobile

## ADDED Requirements

### Requirement: Acesso à lista pela tela inicial

O mobile SHALL permitir abrir a listagem existente ao tocar no cartão de talhões da tela inicial, mantendo quantidade, ícone e identificação acessível.

#### Scenario: Abrir a lista
- **WHEN** a pessoa toca no cartão **Talhões**
- **THEN** o app abre a mesma lista disponível no menu Mais, com seus estados de carregamento, vazio ou indisponível

### Requirement: Edição de talhão existente

O mobile SHALL permitir abrir um talhão da lista, carregar seus dados atuais e salvar alterações online no backend, mantendo a propriedade vinculada.

#### Scenario: Salvar alterações válidas
- **WHEN** a pessoa seleciona um talhão da empresa da sessão, altera dados válidos e confirma
- **THEN** o app envia os campos modificados a `PUT /api/talhoes/<id>`, preserva os demais campos e atualiza lista e seletores após a confirmação

#### Scenario: Registro não disponível ou de outra empresa
- **WHEN** a consulta do talhão ou sua associação à empresa não pode ser confirmada
- **THEN** o app informa o problema e não permite editar ou enviar alterações

#### Scenario: Descartar alterações
- **WHEN** a pessoa tenta sair com alterações não salvas
- **THEN** o app solicita confirmação antes de descartá-las

#### Scenario: Falha ou resposta incerta
- **WHEN** o servidor rejeita a edição ou o resultado do envio não pode ser confirmado
- **THEN** o app preserva os dados em memória, informa o problema e não reenvia automaticamente; para resultado incerto, orienta consultar o registro antes de tentar novamente

#### Scenario: Sucesso com falha de recarga
- **WHEN** o servidor confirma o salvamento mas a atualização posterior da lista falha
- **THEN** o app mantém a mensagem de sucesso e permite repetir apenas a leitura

### Requirement: Ações acessíveis

O mobile SHALL apresentar ícones e rótulos textuais acessíveis para abrir, editar, salvar e voltar no fluxo de talhões.

#### Scenario: Identificar ações
- **WHEN** a pessoa navega pela tela inicial, lista ou formulário de edição
- **THEN** consegue identificar as ações visualmente e por leitor de tela sem depender apenas de cor ou ícone
