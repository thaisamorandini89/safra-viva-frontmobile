# Atividades existentes e atalhos da tela inicial

## ADDED Requirements

### Requirement: Consulta de atividades cadastradas

O mobile SHALL oferecer acesso às atividades existentes retornadas pelo backend que tenham vínculos verificáveis com a empresa da sessão, além dos registros locais existentes, sem criar ou alterar dados durante a consulta.

#### Scenario: Atividade cadastrada no web
- **WHEN** a atividade retornada pelo backend tem associação válida com um talhão e propriedade da empresa da sessão, inclusive quando sua empresa é nula
- **THEN** a atividade aparece na lista e pode ser aberta em detalhes de leitura

#### Scenario: Vínculo inválido ou não verificável
- **WHEN** a atividade possui associação inconsistente, de outra empresa ou impossível de verificar
- **THEN** o app não expõe o registro como pertencente à sessão e apresenta estado de indisponibilidade quando não puder validar os dados necessários

#### Scenario: Consulta indisponível
- **WHEN** a leitura ou a confirmação dos vínculos falha
- **THEN** o app informa a falha, preserva a indicação de dados eventualmente desatualizados e permite nova leitura sem reenviar uma criação

### Requirement: Prévia e acesso à lista completa

A tela inicial SHALL apresentar atividades recentes e um acesso claro à lista completa, independentemente do filtro aplicado anteriormente na lista.

#### Scenario: Abrir atividades
- **WHEN** a pessoa toca em **Atividades** na seção de atalhos ou em **Ver atividades**
- **THEN** o app abre a listagem existente sem criar ou alterar registros

#### Scenario: Ordenação da prévia
- **WHEN** há atividades disponíveis
- **THEN** a prévia apresenta até três registros ordenados de forma determinística pela data de início e identificador, sem aplicar silenciosamente a busca da lista

#### Scenario: Sem atividades ou sem conexão
- **WHEN** a prévia está vazia, carregando, indisponível ou usando dados em memória possivelmente desatualizados
- **THEN** a tela informa o estado correspondente e mantém o acesso à lista

### Requirement: Cartões de atalhos acessíveis

A tela inicial SHALL oferecer cartões com ícones e rótulos para **Nova atividade**, **Talhões**, **Financeiro** e **Insumos**, inspirados nas imagens fornecidas e utilizáveis em diferentes larguras de tela.

#### Scenario: Abrir uma funcionalidade existente
- **WHEN** a pessoa aciona **Nova atividade**, **Talhões** ou **Financeiro**
- **THEN** o app abre o destino correspondente e mantém as permissões existentes

#### Scenario: Abrir insumos indisponível
- **WHEN** a pessoa identifica ou aciona **Insumos** enquanto não existe uma tela funcional
- **THEN** o app comunica a indisponibilidade sem fingir que o financeiro é uma lista de insumos ou realizar uma operação

#### Scenario: Navegar com acessibilidade ou em tela estreita
- **WHEN** a pessoa usa leitor de tela ou o espaço horizontal é limitado
- **THEN** os cartões têm rótulos e papéis acessíveis e todos permanecem alcançáveis

#### Scenario: Acessar sincronização
- **WHEN** a pessoa precisa consultar a fila ou sincronização
- **THEN** existe um acesso identificável na tela inicial ou navegação existente e os estados da fila são preservados

### Requirement: Conferência segura com dados existentes

A validação física SHALL iniciar por leitura de uma atividade identificada e autorizada pela usuária e SHALL NOT criar nem alterar registros reais nesta proposta.

#### Scenario: Comparar uma atividade existente
- **WHEN** a usuária autoriza conferir uma atividade específica
- **THEN** lista e detalhe mobile são comparados ao backend sem divulgar credenciais nem modificar dados

#### Scenario: Dados reais indisponíveis
- **WHEN** a atividade ou autorização necessária não está disponível
- **THEN** a conferência física permanece pendente e os testes simulados não são apresentados como validação real
