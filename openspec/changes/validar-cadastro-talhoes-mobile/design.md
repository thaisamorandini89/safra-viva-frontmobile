# Design

## Context

O mobile já oferece **Mais → Talhões → Novo talhão**, com seleção de propriedades da empresa da sessão, validação, POST e recarga da lista e dos seletores. A mudança anterior já cobre os contratos com testes simulados; sua verificação física de criação continua pendente. O backend retorna `201` com `id_talhao` e `nome_talhao`, possui leitura por ID e aceita `PUT` parcial, retornando ID e nome na confirmação. O cartão da tela inicial e os cartões da lista atualmente não são acionáveis.

## Goals / Non-Goals

**Goals:** confirmar a integração real de criação, oferecer atalho para a lista e edição de talhões existentes, preservando a propriedade vinculada e atualizando as listas.

**Non-Goals:** reimplementar o cadastro sem necessidade; adicionar exclusão ou troca de propriedade; alterar backend/web; criar atividade ou enviar outro POST automaticamente após resultado incerto.

## Decisions

1. Conferir os campos do formulário, os nomes enviados, valores padrão e os catálogos contra o serviço atual do backend. Manter a propriedade selecionável somente entre as da empresa na sessão e verificar sessão antes do envio.
2. Executar primeiro os testes automatizados existentes com respostas simuladas e acrescentar testes apenas para divergências encontradas. Preservar validação e estados de carregamento, rejeição, ausência de conexão e resultado incerto.
3. Antes do teste real, obter confirmação explícita da propriedade, nome, código, área total e demais valores usados. Registrar o identificador retornado e conferir o registro na listagem e no seletor de atividades; não salvar uma atividade. Não expor credenciais, tokens ou detalhes internos do servidor.
4. Se ocorrer timeout ou falha após o envio, não repetir automaticamente nem criar outro registro: consultar a lista e o backend para verificar o resultado antes de qualquer decisão.
5. Se o servidor confirmar a criação, mas a atualização posterior falhar, preservar a confirmação e tentar apenas a leitura. O filtro por empresa do mobile é prevenção de erro de uso, não autorização no servidor.
6. Tornar o cartão de talhões da tela inicial acionável, com quantidade, ícone, indicação visual e rótulo acessível, seguindo o cartão de propriedades. Usar a lista existente inclusive quando vazia ou indisponível.
7. Ao tocar num talhão da lista, buscar os dados por ID e verificar a propriedade associada contra a empresa da sessão antes de abrir o formulário. Reutilizar o formulário existente com estado de edição separado, preservando campos e seleção de catálogos indisponíveis. Não permitir alterar a propriedade vinculada.
8. Validar os dados e enviar ao `PUT /api/talhoes/<id>` somente campos modificados, preservando zeros e tratando campos opcionais vazios segundo o contrato. Não alterar outros campos nem o status geral do registro. Solicitar confirmação antes de descartar alterações e bloquear submissões simultâneas.
9. Após `200`, confirmar o salvamento e atualizar listas e seletores; se a recarga falhar, repetir apenas a leitura. Se o resultado for incerto, preservar os dados em memória, bloquear reenvio automático e orientar consultar o talhão no servidor antes de tentar novamente. Não há controle de versão no backend; alterações simultâneas no mesmo campo podem se sobrescrever.

## Risks / Trade-offs

- O backend analisado não aplica isolamento de empresa nas rotas examinadas; a segurança para produção exige proteção no servidor, fora deste escopo.
- Sem chave de idempotência, uma resposta perdida pode esconder um cadastro concluído e requer conferência manual antes de nova tentativa.
- O teste físico depende de conexão, sessão válida e dados de teste autorizados pela usuária.
- A filtragem mobile não impede acesso direto à API nem garante proteção entre empresas; a edição simultânea não tem detecção de conflito no servidor.
