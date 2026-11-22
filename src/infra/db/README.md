# Banco local

`LocalDb` define a interface implementada por `SqliteLocalDb` usando
`@op-engineering/op-sqlite`. As operações na mesma instância são serializadas,
inclusive durante transações. Dentro do callback de transação, use apenas o
objeto de transação recebido, não a instância externa do banco. Ao salvar uma
entidade, o registro local e seu evento são escritos na mesma transação.

`openLocalDb` habilita chaves estrangeiras e executa as migrações na abertura.
`migrations/initial.ts` é aplicada somente à versão 0. A migração e a mudança
de `user_version` ocorrem na mesma transação; falhas revertem ambas. Versões
desconhecidas são recusadas. O aplicativo informa se a abertura foi bem-sucedida.

Os dados das entidades e os eventos usam JSON; o formulário de atividades usa
os campos confirmados no backend. Datas de registro local são salvas em UTC no
formato ISO 8601. O campo
`sequence` preserva a ordem de inserção dos eventos, inclusive quando duas
alterações têm o mesmo horário. Tokens não devem ser armazenados em `kv`, no
banco local ou nos erros de sincronização; use armazenamento seguro nativo.

`OfflineRepository` cria, atualiza e lista as duas entidades. Cada criação ou
atualização grava o registro e seu evento na mesma transação; o chamador deve
fornecer IDs únicos e um payload de evento adequado ao contrato do backend. Os
dados e o payload representam snapshots completos. Nas atividades, atualizar
sem localização remove a localização anterior; o chamador deve incluí-la para
preservá-la. Datas aceitas usam o formato de `Date.toISOString()`.

O formulário de atividades e o transporte de sincronização estão integrados.
Os testes exercitam SQLite real no Node com um substituto da ponte nativa. A
abertura e migração iniciais foram verificadas em emulador Android; persistência,
mutações e sincronização ainda precisam ser verificadas em dispositivos Android
e iOS.
