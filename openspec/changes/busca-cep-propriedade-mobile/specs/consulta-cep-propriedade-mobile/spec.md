# Spec Delta

## Purpose

Facilitar o preenchimento do endereço de uma propriedade no aplicativo, consultando o CEP e relacionando o resultado aos cadastros geográficos do backend.

## ADDED Requirements

### Requirement: Consulta voluntária de CEP

O formulário de propriedade SHALL permitir consultar um CEP brasileiro de oito dígitos, aceitando sua formatação usual, e SHALL informar o andamento da consulta.

#### Scenario: CEP válido consultado
- **WHEN** a pessoa informa um CEP com oito dígitos e seleciona Buscar CEP
- **THEN** o app consulta o serviço de CEP e apresenta o estado de carregamento sem enviar o cadastro da propriedade

#### Scenario: CEP inválido
- **WHEN** a pessoa solicita a busca com um CEP que não contém exatamente oito dígitos
- **THEN** o app indica o erro e não realiza consulta externa

#### Scenario: Consulta já em andamento
- **WHEN** uma consulta está em andamento
- **THEN** o app impede consultas duplicadas para a mesma ação e continua permitindo editar o formulário

### Requirement: Preenchimento assistido e seleção geográfica

O app SHALL utilizar os dados de CEP e os catálogos do backend para sugerir o endereço, selecionando identificadores de estado e cidade apenas quando houver correspondência inequívoca.

#### Scenario: Endereço encontrado com correspondência
- **WHEN** a consulta retorna logradouro, UF e cidade e os catálogos contêm correspondências inequívocas
- **THEN** o app preenche os campos de endereço vazios disponíveis e seleciona o estado e a cidade correspondentes
- **AND** mantém os campos editáveis e usa o identificador da cidade fornecido pelo backend

#### Scenario: Dados já preenchidos
- **WHEN** a consulta retorna valores que conflitam com campos de endereço já preenchidos
- **THEN** o app preserva esses valores e oferece uma ação explícita para aplicar as sugestões conflitantes
- **AND** não altera silenciosamente a cidade ou o estado previamente selecionados

#### Scenario: Município ausente ou ambíguo
- **WHEN** a UF ou a cidade retornada não encontra correspondência inequívoca no catálogo do backend
- **THEN** o app informa a necessidade de seleção manual e não atribui um identificador por aproximação

#### Scenario: Dados parciais
- **WHEN** o serviço retorna CEP conhecido sem logradouro ou bairro
- **THEN** o app não apaga os dados já informados e permite completar o endereço manualmente

### Requirement: Preservação de dados e tratamento de falhas

O app SHALL preservar o formulário e permitir preenchimento manual quando a consulta ou o carregamento dos catálogos não puder ser concluído.

#### Scenario: CEP não encontrado
- **WHEN** o serviço informa que o CEP não foi encontrado
- **THEN** o app informa o resultado sem apagar o endereço preenchido e permite outra consulta ou preenchimento manual

#### Scenario: Serviço ou catálogo indisponível
- **WHEN** o serviço de CEP ou o catálogo necessário falha, excede o tempo limite ou está inacessível
- **THEN** o app apresenta mensagem compreensível, mantém os dados digitados e oferece nova tentativa ou seleção manual

#### Scenario: Resposta atrasada
- **WHEN** o CEP é alterado, uma nova consulta substitui a anterior ou o formulário é encerrado antes da resposta
- **THEN** o app ignora o resultado desatualizado e não modifica o formulário com ele

#### Scenario: Edição durante a consulta
- **WHEN** a pessoa altera um campo de endereço enquanto a consulta está em andamento
- **THEN** uma resposta posterior não substitui silenciosamente essa edição

### Requirement: Envio do endereço e privacidade

O app SHALL manter o endereço opcional e validar os dados exigidos pelo backend antes de criar a propriedade. A consulta de CEP SHALL enviar somente o CEP necessário ao serviço externo, sem credenciais da sessão.

#### Scenario: Endereço completo
- **WHEN** a pessoa informa CEP, cidade e logradouro válidos e confirma o cadastro
- **THEN** o app envia o CEP normalizado, o identificador da cidade do backend e o logradouro no POST da propriedade

#### Scenario: Endereço parcial
- **WHEN** a pessoa tenta salvar um endereço parcialmente preenchido
- **THEN** o app identifica os campos ausentes e não afirma que o endereço foi salvo

#### Scenario: Endereço omitido
- **WHEN** a pessoa não preenche nenhum campo de endereço e os demais dados são válidos
- **THEN** a consulta de CEP não é exigida para cadastrar a propriedade
