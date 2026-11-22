# Edição de propriedade mobile

## ADDED Requirements

### Requirement: Abertura da propriedade pela lista

O mobile SHALL permitir abrir a propriedade da empresa da sessão a partir de seu cartão e carregar seus dados atuais do backend antes da edição.

#### Scenario: Selecionar propriedade
- **WHEN** a pessoa toca no cartão de uma propriedade disponível
- **THEN** o app consulta `GET /api/propriedades/<id>` e abre o formulário preenchido com os dados retornados

#### Scenario: Registro indisponível ou de outra empresa
- **WHEN** a consulta falha, o registro não existe ou sua empresa difere da sessão
- **THEN** o app informa o problema e não permite editar ou salvar esse registro

### Requirement: Edição e salvamento online

O mobile SHALL permitir editar os campos suportados e salvar as alterações por `PUT /api/propriedades/<id>`, sem modificar campos não alterados ou a empresa vinculada.

#### Scenario: Alterações válidas
- **WHEN** a pessoa altera campos válidos e confirma o salvamento online
- **THEN** o app envia os campos alterados ao backend e, após HTTP 200, confirma o sucesso e atualiza lista e seletores relacionados

#### Scenario: Dados inválidos ou saída com alterações
- **WHEN** há campos inválidos ou a pessoa tenta voltar com alterações não salvas
- **THEN** o app indica os erros sem enviar ou pede confirmação antes de descartar, respectivamente

#### Scenario: Falha ou resultado incerto
- **WHEN** o envio falha ou seu resultado não pode ser confirmado
- **THEN** o app preserva os dados em memória, não reenvia automaticamente e apresenta orientação apropriada; para resultado incerto, orienta consultar o registro antes de tentar novamente

#### Scenario: Falha na atualização após confirmação
- **WHEN** o backend confirma a edição mas a atualização posterior das listas falha
- **THEN** o app mantém a mensagem de sucesso e permite tentar novamente a leitura sem repetir o PUT

### Requirement: Preservação e edição de endereço

O mobile SHALL preservar o endereço existente e SHALL enviar os dados completos do endereço quando ele for alterado, conforme o contrato do backend.

#### Scenario: Endereço inalterado
- **WHEN** a pessoa salva sem alterar o endereço
- **THEN** o app omite os campos de endereço no PUT

#### Scenario: Endereço alterado
- **WHEN** a pessoa altera o endereço e informa CEP, cidade e logradouro válidos
- **THEN** o app envia esses campos juntos com os demais dados atuais do endereço

#### Scenario: Endereço incompleto ou catálogo indisponível
- **WHEN** o endereço alterado está incompleto ou a cidade não pode ser validada
- **THEN** o app não envia a alteração do endereço e preserva os valores informados para correção

### Requirement: Ações didáticas e acessíveis

O mobile SHALL apresentar ícones acompanhados de texto e rótulos acessíveis nas ações relevantes do fluxo de propriedades.

#### Scenario: Ações do fluxo
- **WHEN** a pessoa visualiza lista, edição ou busca de CEP
- **THEN** os comandos de criar, editar, buscar, salvar e voltar são identificáveis por texto e ícones adequados, inclusive para leitores de tela

### Requirement: Limites de segurança e conexão

O mobile SHALL verificar a empresa e SHALL NOT apresentar a filtragem local como garantia de segurança no backend.

#### Scenario: Sem conexão ou sessão válida
- **WHEN** não há conexão com o backend ou empresa válida na sessão
- **THEN** o app impede o salvamento, explica o motivo e não cria uma operação offline
