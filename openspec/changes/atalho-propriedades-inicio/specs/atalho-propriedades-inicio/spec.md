# Atalho de propriedades na tela inicial

## ADDED Requirements

### Requirement: Acesso direto à listagem de propriedades

O mobile SHALL permitir acessar a listagem existente ao tocar no cartão de propriedades na tela inicial.

#### Scenario: Abrir a lista
- **WHEN** a pessoa toca no cartão **Propriedades** na tela inicial
- **THEN** o app abre a mesma listagem disponível no menu Mais

#### Scenario: Lista vazia ou dados indisponíveis
- **WHEN** não há propriedades carregadas ou os dados estão indisponíveis
- **THEN** o cartão continua acionável e a listagem apresenta seu estado existente apropriado

### Requirement: Identificação acessível do atalho

O cartão SHALL preservar a informação de quantidade e indicar visualmente e para tecnologias assistivas que abre a listagem.

#### Scenario: Identificar o cartão
- **WHEN** a pessoa visualiza o cartão ou navega usando leitor de tela
- **THEN** consegue identificar a ação de abrir propriedades e a quantidade disponível ou sua indisponibilidade
