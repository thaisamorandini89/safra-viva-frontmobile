# mobile-offline-first Specification

## Purpose
Garantir que o SafraViva Mobile funcione **offline-first** (operações essenciais sem internet),
com **sincronização confiável** quando houver conexão e com suporte a **GPS/fotos** como evidência de campo.

## Requirements

### Requirement: Autenticação e sessão

O app SHALL autenticar via `POST /api/auth/login` e armazenar o token de forma segura.

- **WHEN** o usuário faz login com credenciais válidas
- **THEN** o app armazena o token e consegue acessar `GET /api/auth/me`
- **AND** quando o token estiver ausente ou inválido, o app solicita login novamente

### Requirement: Banco local e modo offline

O app SHALL persistir dados e alterações localmente (SQLite), permitindo criação/edição sem internet.

- **WHEN** o dispositivo estiver offline
- **THEN** o usuário consegue registrar atividades e movimentações
- **AND** as alterações são gravadas no banco local
- **AND** as alterações entram em uma fila de sincronização

### Requirement: Fila de sincronização (eventos)

O app SHALL registrar mudanças como eventos (create/update/delete) para permitir reprocessamento,
retentativas e diagnóstico.

Cada evento SHALL conter no mínimo:

- `id`
- `entityType`
- `operation`
- `payload`
- `createdAt`
- `retryCount`
- `status` (Pendente | Sincronizando | Sincronizado | Erro)
- `lastError` (opcional)

### Requirement: Indicador de status de conexão/sync

O app SHALL exibir claramente o status:

- 🔴 Offline
- 🟡 Sincronizando
- 🟢 Online

### Requirement: Sincronização manual e automática

O app SHALL oferecer:

- Sincronização automática ao detectar internet
- Botão de "Sincronizar agora"
- Tela de erros de sync com opção de "tentar novamente"

### Requirement: MVP de entidades offline

No MVP, o app SHALL suportar offline (criar/editar/listar) pelo menos:

- `atividade_agricola` (via `/api/atividades`)
- `movimentacao_estoque` (via `/api/movimentacoes`)

### Requirement: GPS offline

O app SHALL capturar coordenadas GPS durante o registro de uma atividade.

- **WHEN** o usuário registra uma atividade no campo
- **THEN** o app captura (quando permitido) `latitude/longitude` e data/hora
- **AND** a atividade pode ser salva mesmo sem internet

### Requirement: Fotos offline

O app SHALL permitir anexar fotos a atividades.

- **WHEN** o usuário tira uma foto em uma atividade
- **THEN** a foto é salva localmente
- **AND** a foto é enviada quando houver conexão

## Notes

- Para suportar offline-first com consistência, é recomendável adicionar endpoints de sincronização
  incremental no backend (push/pull por cursor). Caso isso não exista, o app pode iniciar com
  sincronização por chamadas REST tradicionais + fila (MVP), evoluindo depois.

