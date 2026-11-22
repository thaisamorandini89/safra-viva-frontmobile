# Proposal

## Why

O SafraViva já tem **backend (Flask/PostgreSQL)** e **frontend web (React/Vite)**, mas o uso em campo sofre
com um problema estrutural: **conectividade instável**. O mobile precisa nascer como **offline-first** para
garantir que atividades, estoque, fotos e evidências de GPS sejam capturadas no momento certo (no talhão),
sem depender de internet.

Além disso, no campo o usuário frequentemente está com luvas, dirigindo ou operando equipamento. Um fluxo
por **voz** reduz o tempo de registro e aumenta a adesão.

## What Changes

- **Novo módulo Mobile** em `frontmobile/` com **React Native + TypeScript**.
- **Banco local (SQLite)** para permitir operação offline e cache de dados de apoio.
- **Fila de sincronização por eventos** (create/update/delete) com retentativas, logging de erro e opção
  de sincronização manual.
- **Funcionalidades offline do MVP**:
  - Registro de `atividade_agricola` (baseado em `/api/atividades`).
  - Registro de `movimentacao_estoque` (baseado em `/api/movimentacoes`).
  - Consulta local (últimas atividades, pendências de sync, resumo operacional).
  - Captura de **GPS** e anexos de **fotos** vinculados a atividades.
- **SafraIA no mobile**:
  - Consumo do endpoint existente `POST /api/safra-ia/consultar` (Gemini) para consultas e assistência.
  - Camada de voz no device (speech-to-text + text-to-speech) para modo "mãos livres".
  - Fallback offline: quando não houver internet, o app usa um fluxo guiado (sem LLM) para registrar
    atividades essenciais.

## Tech Choices (React Native)

- **React Native (bare workflow)**: facilita integração com banco local, background sync e voz.
- **SQLite**: `react-native-sqlite-storage` ou `expo-sqlite` (se for Expo). Para evitar amarrar a escolha,
  o projeto pode começar com uma interface `LocalDb` e trocar o driver depois.
- **Data fetching**: `@tanstack/react-query` (já usado no web) para chamadas online e cache de requests.
- **HTTP client**: `axios` (já usado no web).
- **State**: `zustand` ou `redux-toolkit` (se quiser padrão mais opinionado).
- **Auth storage**: Keychain/Keystore (ex.: `react-native-keychain`).
- **Connectivity**: `@react-native-community/netinfo`.
- **Background sync**: Android com HeadlessJS/BackgroundFetch; iOS com Background Fetch (limitado pelo SO).
- **Voz**: STT/TTS via libs nativas (`react-native-voice`, `react-native-tts`).

## Backend Impacts

O backend hoje expõe endpoints REST tradicionais (ex.: `/api/atividades`, `/api/movimentacoes`).
Para um offline-first mais robusto (evitar conflitos e reduzir tráfego), é recomendável adicionar
um contrato de sincronização incremental:

- `POST /api/sync/push` (envia eventos pendentes)
- `GET /api/sync/pull?cursor=...` (baixa mudanças incrementais)

No MVP, o mobile pode operar com fila + endpoints existentes, evoluindo para `sync/push|pull` na fase 2.

## Out of scope (MVP)

- Mapas offline completos (tiles/MBTiles) e trilha GPS contínua.
- Resolução avançada de conflitos com UI de diff.
- Push notifications/SignalR.

