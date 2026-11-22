# Identidade visual mobile

## ADDED Requirements

### Requirement: Marca SafraViva consistente

O aplicativo SHALL apresentar a marca do sistema web no login, na tela inicial e nos cabeçalhos das telas, sem exigir conexão.

#### Scenario: Login e navegação
- **WHEN** a pessoa abre o aplicativo ou navega entre telas
- **THEN** a marca SafraViva aparece com tamanho e contraste adequados, sem ocultar títulos ou controles de navegação

#### Scenario: Acessibilidade e telas pequenas
- **WHEN** a pessoa utiliza leitor de tela ou um dispositivo de largura reduzida
- **THEN** a marca não impede a leitura e o acesso aos controles, sem repetir desnecessariamente o nome do aplicativo

#### Scenario: Sem conexão
- **WHEN** o aparelho está offline
- **THEN** o recurso visual local continua disponível
