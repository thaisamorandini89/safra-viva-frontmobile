# Núcleo de sincronização

`SyncService` processa eventos por ordem de inserção. Após confirmar uma criação,
associa o ID recebido do servidor ao registro local antes de enviar alterações
posteriores. A atualização do evento e do estado local ocorre em transação.
Um erro ou evento aguardando backoff interrompe a fila inteira para preservar a
ordem. Processamentos concorrentes não enviam novamente um evento já em envio.

`BackendSyncTransport` usa os contratos REST do backend consultado: atividades
aceitam POST, PUT e DELETE; movimentações de estoque aceitam POST. A sessão é
verificada antes do processamento e o banco é vinculado ao servidor e usuário.
O backend não oferece uma chave de idempotência para esses endpoints. O transporte
deve usar o ID do evento como chave de idempotência se o backend passar a oferecer
essa garantia. Ele retorna:

- `success` apenas depois da confirmação; para criações, inclui `serverId`.
- `retry` apenas se houver certeza de que o servidor não aplicou o evento, ou
  se o servidor garantir idempotência para aquele evento. O serviço agenda nova
  tentativa com backoff.
- `rejected` para uma rejeição definitiva conhecida, como falha de validação.
- `unknown` quando não for possível determinar se a operação foi aplicada.

Exceções também são tratadas como resultado desconhecido, sem salvar detalhes
que possam conter credenciais. Resultados desconhecidos, rejeições e criações
confirmadas sem ID interrompem a fila; não são reenviados automaticamente. É
necessário criar um fluxo de reconciliação/correção antes de retomá-los. Chamar
`markInterruptedAsUncertain` somente na inicialização, quando não houver nenhum
processador ativo, para bloquear eventos interrompidos em vez de duplicá-los.

A interface mostra conectividade e a fila local, com envio automático e manual
quando a sessão está ativa e a internet disponível. Conectividade não confirma
acesso ao backend. Ainda faltam reconciliação de resultados incertos, resolução
de conflitos, sessão persistente segura e validação ponta a ponta com sessão
válida e envio real. A abertura do banco e a conectividade foram verificadas em
emulador Android; iOS e dispositivos físicos ainda precisam de validação.
O transporte não reenvia automaticamente após timeout ou erro de servidor.
