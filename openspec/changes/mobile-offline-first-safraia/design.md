# Design

## Goals

- Offline-first: registrar operações no campo sem internet.
- Sync confiável: não perder dados e permitir retentativas.
- UX de campo: telas rápidas + modo mãos livres com voz.
- Reuso com o web: TypeScript, axios, React Query e DTOs.

## Non-goals (MVP)

- Conflito com diff completo e merge campo-a-campo.
- Mapa offline por região/tiles.

## Mobile Architecture (React Native)

### Camadas

- `src/ui/`: telas e componentes.
- `src/app/`: casos de uso (ex.: `criarAtividade`, `sincronizarAgora`).
- `src/domain/`: entidades e regras (validações, normalização de dados).
- `src/infra/`: banco local, fila de sync, API client, storage seguro.

### Banco local

SQLite com tabelas principais:

- `kv` (config e cursores)
- `sync_queue` (eventos)
- `atividade_agricola_local`
- `movimentacao_estoque_local`
- `anexo_foto` (path local + referência)

Campos de sync mínimos recomendados por registro local:

- `local_id` (UUID)
- `server_id` (nullable)
- `created_at`, `updated_at`
- `device_id`
- `sync_status` (pending/syncing/synced/error)
- `last_error` (nullable)

## Sync Strategy

### MVP (com endpoints atuais)

1. O app cria/edita localmente e registra um evento em `sync_queue`.
2. Ao detectar internet (ou botão manual), processa a fila em ordem:
   - `create`: `POST` na rota do recurso.
   - `update`: `PUT` na rota do recurso (quando existir no backend).
3. Se sucesso: marca evento como `synced`.
4. Se erro recuperável (timeout/503): agenda retry.
5. Se erro de validação (400/422): marca `error` e mostra UI de correção.

### Evolução fase 2 (recomendado)

Adicionar contrato incremental no backend:

- `POST /api/sync/push` recebe lotes de eventos (inclui `device_id` e idempotency key).
- `GET /api/sync/pull` retorna mudanças desde um cursor.

Benefícios: menos chamadas, melhor detecção de conflitos, pull incremental.

## Voice (SafraIA)

### Fluxos

- Registro por voz (mãos livres):
  - intenção (plantio/aplicação/colheita/abastecimento)
  - perguntas curtas para coletar campos obrigatórios
  - confirmação e gravação local

### Online vs offline

- Online: STT local -> prompt para `/api/safra-ia/consultar` -> resposta com sugestão -> confirmação.
- Offline: STT local -> parser simples (regras) + formulário guiado.

## Security

- Token do backend armazenado no Keychain/Keystore.
- Logs de erro de sync não devem incluir credenciais.

