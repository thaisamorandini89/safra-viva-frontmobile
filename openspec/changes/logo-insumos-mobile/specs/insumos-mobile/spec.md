# Insumos mobile

## ADDED Requirements

### Requirement: Acesso e consulta de insumos

O aplicativo SHALL permitir abrir e pesquisar os insumos reais do backend por meio de um atalho rápido e uma opção identificável de navegação, com detalhes e filtros apropriados.

#### Scenario: Insumo existente na empresa
- **WHEN** o backend retorna um insumo com propriedade verificada da empresa da sessão
- **THEN** ele aparece na lista e pode ser aberto com seus dados de estoque e lotes disponíveis

#### Scenario: Vínculo ausente ou de outra empresa
- **WHEN** o insumo não tem propriedade, pertence a outra empresa ou possui vínculo inconsistente
- **THEN** o aplicativo não o apresenta nem permite modificá-lo como registro da sessão

#### Scenario: Falha ou offline
- **WHEN** a consulta ou verificação de vínculos falha
- **THEN** o app informa a indisponibilidade, oferece nova tentativa e não apresenta dados de demonstração como registros reais

### Requirement: Cadastro e manutenção

O aplicativo SHALL permitir criar, editar e solicitar exclusão de insumos de propriedade verificada usando os contratos do backend e validações aplicáveis.

#### Scenario: Cadastro e estoque inicial
- **WHEN** a pessoa informa dados válidos e confirma a criação online
- **THEN** o app envia produto existente ou novo e propriedade verificada, e informa que estoque inicial positivo gera entrada

#### Scenario: Edição de saldo
- **WHEN** a pessoa edita um insumo
- **THEN** o saldo não é alterado por edição direta e eventuais alterações em produto compartilhado não são feitas sem escopo seguro

#### Scenario: Exclusão
- **WHEN** a pessoa solicita exclusão de um insumo elegível
- **THEN** o app pede confirmação explícita e apresenta o resultado ou recusa do servidor

### Requirement: Movimentações e rastreabilidade

O aplicativo SHALL consultar o histórico e permitir registrar entradas e saídas online para insumos de propriedade verificada, conforme o backend.

#### Scenario: Movimentação confirmada
- **WHEN** o servidor confirma uma entrada ou saída válida
- **THEN** o app apresenta o resultado confirmado e atualiza saldo e histórico sem simular dados

#### Scenario: Resultado desconhecido
- **WHEN** a conexão é interrompida após o envio e não há resposta conclusiva
- **THEN** o app indica resultado desconhecido, não reenvia automaticamente e orienta conferir o histórico antes de nova tentativa

#### Scenario: Operação offline
- **WHEN** o aparelho está offline
- **THEN** o app não efetua nem enfileira silenciosamente escritas de insumos ou estoque

### Requirement: Indicadores e verificação segura

O aplicativo SHALL limitar indicadores a dados reais elegíveis e validar a integração sem alteração não autorizada de registros reais.

#### Scenario: Indicador de estoque
- **WHEN** os dados necessários estão disponíveis
- **THEN** o indicador é calculado apenas a partir de insumos visíveis da empresa e identifica eventuais dados desatualizados

#### Scenario: Teste no aparelho
- **WHEN** a integração é conferida em dispositivo físico
- **THEN** a conferência começa por leitura, e qualquer escrita real requer confirmação prévia da usuária sobre operação e valores
