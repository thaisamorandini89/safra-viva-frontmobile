# Tasks

## Foundations

- [x] Definir stack: React Native bare, com projetos Android e iOS.
- [x] Criar app RN em `frontmobile/` com TypeScript.
- [ ] Configurar lint/format e estrutura de pastas (`src/ui`, `src/app`, `src/domain`, `src/infra`).

## Auth

- [ ] Implementar login (`POST /api/auth/login`) e sessão (`GET /api/auth/me`).
- [ ] Persistir token no Keychain/Keystore.
- [ ] Criar `ApiClient` (axios) com interceptor para Authorization.

## Offline DB

- [x] Criar camada `LocalDb` e migrations SQLite (validação nativa pendente).
- [x] Implementar tabela `sync_queue`.
- [x] Implementar tabelas locais para `atividade_agricola` e `movimentacao_estoque`.

## Sync

- [x] Implementar detector de conectividade (validação nativa pendente).
- [ ] Implementar `SyncService.processQueue()` (núcleo e transporte implementados; reconciliação e validação ponta a ponta pendentes).
- [ ] Criar tela de status de sync e lista de erros (lista implementada; correção/reconciliação pendentes).
- [x] Adicionar botão "Sincronizar agora" (validação nativa pendente).

## MVP Features

- [ ] Telas: lista/criação/edição de atividades (`/api/atividades`) (lista e criação implementadas; edição pendente).
- [ ] Telas: lista/criação de movimentações (`/api/movimentacoes`).
- [ ] Dashboard offline simples (últimas atividades, pendências).

## GPS + Fotos

- [ ] Captura de localização e armazenamento associado à atividade.
- [ ] Captura de foto e armazenamento local.
- [ ] Upload de anexos na sincronização (definir endpoint/contrato).

## SafraIA (Mobile)

- [x] Tela de chat básica consumindo `POST /api/safra-ia/consultar` (validação ponta a ponta pendente).
- [ ] STT/TTS e modo mãos livres (MVP: iniciar/parar gravação + confirmação).

## Hardening

- [ ] Testes unitários de fila/sync.
- [ ] Telemetria local (logs) e mensagens de erro amigáveis.

