# Verificação do cadastro de talhões mobile

## ADDED Requirements

### Requirement: Cadastro vinculado à propriedade

O fluxo existente SHALL permitir cadastrar online um talhão associado a uma propriedade da empresa da sessão e atualizar as consultas após confirmação do backend.

#### Scenario: Criação confirmada
- **WHEN** a pessoa seleciona uma propriedade permitida, informa nome, código e área total válidos e confirma o cadastro
- **THEN** o app envia os campos aceitos por `POST /api/talhoes` e informa o sucesso após resposta `201`
- **AND** atualiza a listagem de talhões e o seletor de atividades

#### Scenario: Dados inválidos ou propriedade ausente
- **WHEN** os dados obrigatórios são inválidos ou não existe propriedade selecionável da empresa
- **THEN** o app orienta a correção e não envia a criação

### Requirement: Tratamento de resultados de cadastro

O fluxo SHALL preservar o formulário em caso de rejeição e SHALL NOT repetir automaticamente uma criação de resultado incerto.

#### Scenario: Resultado incerto
- **WHEN** a conexão falha após o envio e o resultado não pode ser confirmado
- **THEN** o app bloqueia o reenvio automático e orienta consultar os registros antes de outra tentativa

#### Scenario: Recarga falha depois do sucesso
- **WHEN** o backend confirma a criação, mas a atualização das listas falha
- **THEN** o app mantém a confirmação e não repete o POST

### Requirement: Verificação física autorizada

A verificação física SHALL utilizar uma propriedade e dados de teste confirmados pela usuária antes da criação de um registro real.

#### Scenario: Verificar registro no backend e no aplicativo
- **WHEN** os dados de teste são confirmados e o cadastro retorna sucesso
- **THEN** o teste confere a propriedade vinculada, a listagem e a disponibilidade do talhão no seletor de atividades sem criar atividade
