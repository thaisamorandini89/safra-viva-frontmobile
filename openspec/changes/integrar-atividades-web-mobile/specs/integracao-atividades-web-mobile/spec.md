# Integração de atividades web e mobile

## ADDED Requirements

### Requirement: Listagem de atividades reais

O mobile SHALL consultar as atividades do backend e mostrar registros com associação verificável a propriedade da empresa da sessão, inclusive os criados no web com empresa nula.

#### Scenario: Atividade web sem empresa preenchida
- **WHEN** a atividade tem `id_empresa` nulo ou ausente e seu talhão e propriedade correspondem a uma propriedade verificada da empresa da sessão
- **THEN** a atividade aparece na lista com os dados retornados pelo backend

#### Scenario: Associação conflitante ou não verificável
- **WHEN** a atividade informa outra empresa, talhão de outra propriedade, propriedade de outra empresa ou vínculos que não podem ser verificados
- **THEN** o app não apresenta o registro como pertencente à sessão

#### Scenario: Falha ou ausência de conexão
- **WHEN** a consulta de atividades ou dos vínculos necessários falha
- **THEN** o app informa a indisponibilidade, oferece nova leitura e não apresenta falha como uma lista vazia bem-sucedida
- **AND** distingue qualquer dado anteriormente carregado em memória e os registros locais pendentes dos dados atuais do servidor

#### Scenario: Catálogo ou serviço não relacionado indisponível
- **WHEN** as atividades e os vínculos necessários são carregados, mas uma consulta não relacionada falha
- **THEN** a lista de atividades verificadas continua disponível

### Requirement: Consulta e detalhes acessíveis

O mobile SHALL permitir buscar e abrir atividades da lista, identificando o registro e seu estado de sincronização.

#### Scenario: Consultar atividade remota
- **WHEN** a pessoa seleciona uma atividade do servidor e a consulta por ID confirma os vínculos com a sessão
- **THEN** o app apresenta os dados atuais disponíveis, inclusive status, datas, responsável, observações, custos e itens relacionados, sem modificá-los

#### Scenario: Consultar atividade local
- **WHEN** a pessoa seleciona uma atividade ainda não confirmada pelo servidor
- **THEN** o app apresenta os dados locais e o estado da fila sem afirmar que a atividade foi sincronizada

### Requirement: Cadastro básico integrado

O mobile SHALL preservar o cadastro local de atividade planejada e o envio pela fila existente, usando categoria, tipo, talhão e empresa coerentes com a sessão.

#### Scenario: Dados válidos
- **WHEN** a pessoa informa categoria e tipo compatíveis, talhão de propriedade da empresa, data válida e demais dados válidos e confirma
- **THEN** o app salva a atividade e o evento localmente e envia o contrato existente quando a sincronização puder ocorrer
- **AND** indica claramente que o envio pode ser automático quando estiver online

#### Scenario: Dados inválidos ou cadastros indisponíveis
- **WHEN** faltar algum vínculo obrigatório, a data ou valor forem inválidos ou os dados de apoio necessários estiverem indisponíveis
- **THEN** o app orienta a correção e não cria evento ou envia POST inválido

### Requirement: Resultados de sincronização visíveis

O mobile SHALL preservar os registros locais e não repetir automaticamente um envio cujo resultado seja desconhecido.

#### Scenario: Resultado incerto
- **WHEN** o envio não puder ser confirmado
- **THEN** a atividade permanece identificada com estado apropriado e o app orienta conferência antes de qualquer novo envio

#### Scenario: Envio confirmado, leitura posterior indisponível
- **WHEN** a criação recebe confirmação com ID, mas a atualização do servidor falha
- **THEN** a confirmação e uma representação local identificada permanecem visíveis
- **AND** o app oferece nova leitura sem repetir o POST

#### Scenario: Atividade confirmada aparece na consulta
- **WHEN** a consulta posterior contém o ID confirmado da atividade local
- **THEN** o app apresenta um único registro sem deduplicar outros registros por semelhança de campos

### Requirement: Verificação física autorizada

O teste físico SHALL começar por leitura e SHALL NOT criar ou alterar dados reais sem confirmação explícita.

#### Scenario: Consultar atividade existente
- **WHEN** a usuária identifica uma atividade que autoriza conferir
- **THEN** o teste compara lista e detalhe mobile com o backend sem modificar o registro

#### Scenario: Autorizar criação de teste
- **WHEN** a usuária confirma propriedade, talhão, categoria, tipo, data e demais dados de teste
- **THEN** a criação pode ser testada com ciência de que a fila pode enviar automaticamente e o resultado é conferido no backend
