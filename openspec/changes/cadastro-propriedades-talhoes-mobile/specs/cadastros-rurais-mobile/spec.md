## ADDED Requirements

### Requirement: Cadastro de propriedade

O mobile SHALL permitir que a pessoa autenticada abra um formulário de nova propriedade a partir da lista de propriedades e, quando informados os dados válidos, envie a criação ao backend para a empresa da sessão.

#### Scenario: Propriedade criada
- **WHEN** a pessoa informa nome, CAR, latitude, longitude, área total, área agricultável e área de preservação válidos e confirma o cadastro online
- **THEN** o app envia `POST /api/propriedades` com `id_empresa` da sessão e os demais campos informados
- **AND** após resposta `201`, informa o sucesso e atualiza a lista de propriedades e as opções usadas nos demais fluxos

#### Scenario: Empresa indisponível
- **WHEN** a sessão não possui empresa vinculada ou não pode ser verificada
- **THEN** o app impede o envio e explica como proceder sem permitir informar uma empresa arbitrária

#### Scenario: Campos inválidos
- **WHEN** dados obrigatórios estão ausentes, as áreas são inválidas ou as coordenadas estão fora de seus intervalos
- **THEN** o app identifica os campos a corrigir e não envia a criação

#### Scenario: Endereço parcial
- **WHEN** a pessoa inicia o preenchimento do endereço sem informar CEP, cidade e logradouro
- **THEN** o app solicita os dados faltantes antes do envio e não informa que um endereço incompleto foi salvo

### Requirement: Cadastro de talhão

O mobile SHALL permitir cadastrar um talhão em uma propriedade disponível da empresa da sessão, enviando os nomes e identificadores esperados pelo backend.

#### Scenario: Talhão criado
- **WHEN** a pessoa escolhe uma propriedade da empresa e informa nome, código e área total válidos
- **THEN** o app envia `POST /api/talhoes` com `nome_talhao`, `codigo_talhao`, `id_propriedade`, `area_total` e os campos opcionais informados
- **AND** após resposta `201`, informa o sucesso e atualiza a lista de talhões e o seletor de atividades

#### Scenario: Propriedade ausente
- **WHEN** não há propriedade disponível para a empresa da sessão
- **THEN** o app orienta a pessoa a cadastrar uma propriedade antes do talhão e não envia um identificador arbitrário

#### Scenario: Áreas inválidas
- **WHEN** a área total não é positiva ou a área utilizável é negativa ou superior à área total
- **THEN** o app indica o erro e não envia o cadastro

### Requirement: Campos auxiliares e coordenadas

O mobile SHALL oferecer os campos opcionais compatíveis com o backend e carregar os catálogos necessários sem fingir que uma seleção indisponível foi salva.

#### Scenario: Tipo de solo selecionado
- **WHEN** a pessoa seleciona um tipo de solo disponível
- **THEN** o app envia seu identificador em `id_tipo_solo`, não a descrição como identificador

#### Scenario: Catálogo opcional indisponível
- **WHEN** um catálogo de campo opcional não pode ser carregado
- **THEN** o app informa a indisponibilidade, permite tentar carregar novamente e não impede o envio dos campos obrigatórios válidos sem esse campo opcional

### Requirement: Estado do cadastro e prevenção de duplicidade

O mobile SHALL comunicar o resultado do envio e evitar reenvios automáticos quando o resultado for incerto.

#### Scenario: Sem conexão
- **WHEN** a pessoa tenta cadastrar sem conexão com o backend
- **THEN** o app informa que o cadastro requer conexão, preserva o formulário em memória e não adiciona a criação à fila de atividades

#### Scenario: Envio já em andamento
- **WHEN** o envio de uma criação está em andamento
- **THEN** o app bloqueia novas submissões do mesmo formulário até receber o resultado

#### Scenario: Resultado incerto
- **WHEN** a conexão é perdida ou ocorre timeout depois de uma criação ter sido enviada sem confirmação de resultado
- **THEN** o app não reenvia automaticamente nem libera nova submissão imediata do mesmo formulário
- **AND** orienta a consultar a lista do servidor antes de decidir criar novamente

#### Scenario: Atualização da lista falha após criação
- **WHEN** o backend confirma a criação e a atualização posterior das listas falha
- **THEN** o app mantém a confirmação de criação, informa a falha de atualização e não repete o POST

#### Scenario: Rejeição explícita
- **WHEN** o backend rejeita a criação com erro de validação ou autorização
- **THEN** o app preserva os campos e apresenta mensagem compreensível sem expor credenciais ou detalhes internos

### Requirement: Limites de segurança da empresa

O mobile SHALL restringir as opções de propriedade à empresa da sessão e SHALL NOT apresentar essa filtragem como garantia de isolamento no servidor.

#### Scenario: Propriedade de outra empresa recebida na lista
- **WHEN** a API retorna propriedades de mais de uma empresa
- **THEN** o app apresenta no formulário apenas propriedades da empresa da sessão
- **AND** a documentação esclarece que a autorização e o isolamento reais dependem do backend
