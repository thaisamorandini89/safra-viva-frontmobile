# Design

## Context

O web consulta atividades reais em `GET /api/atividades` e as cria em `POST /api/atividades`. O formulário web envia categoria, tipo, talhão, responsável, datas e demais dados, mas não envia `id_empresa`; o backend permite empresa nula e deriva `id_propriedade` do talhão quando omitida. Portanto, o filtro mobile atual que exige igualdade de `id_empresa` pode excluir registros do web. O backend retorna identificador, associações, nomes, status, datas, responsável, observações, custos e listas de insumos e máquinas.

O mobile já carrega as categorias e tipos ativos, salva atividades locais no SQLite como `Planejada` e enfileira o POST; a sincronização pode iniciar automaticamente online. O carregamento remoto atual usa `Promise.all` para atividades, propriedades, talhões, safras e catálogos, portanto uma falha não relacionada pode impedir a listagem. A lista oculta registros locais com status sincronizado mesmo se a leitura posterior do servidor falhar.

## Goals / Non-Goals

**Goals:** consultar e apresentar registros reais do web; expor detalhes sem mutação; tornar o cadastro básico utilizável e coerente com o backend; manter e tornar visíveis os estados da fila existente; realizar testes seguros e verificáveis.

**Non-Goals:** alterar backend/web; adicionar edição ou exclusão de atividade, mudança de status, insumos ou máquinas; dar baixa de estoque; adicionar idempotência inexistente ou substituir a fila; criar registros reais sem autorização; prometer autenticação, isolamento multiempresa ou cache persistente de atividades remotas que não existam.

## Decisions

1. Carregar atividades independentemente de safras, indicadores financeiros e catálogos de criação. Propriedades e talhões da sessão continuam pré-requisitos para filtrar com segurança de uso; em falha desses dados não exibir registros não verificados nem apresentar lista vazia como sucesso. Revalidar sessão e oferecer nova leitura.
2. Admitir apenas atividade cujo talhão esteja entre os talhões de propriedades verificadas da empresa e cuja `id_propriedade` corresponda à propriedade desse talhão. Se `id_empresa` for igual à da sessão ou for nula/ausente, incluir; se estiver preenchida com outra empresa, ou se houver divergência, falta de associação ou dados inválidos, excluir. Não preencher ou modificar o registro no backend e não inferir associação apenas pelo nome. Isso é prevenção na interface, não controle de acesso.
3. Na lista, mostrar tipo, talhão, propriedade, data e status, com pesquisa e atualização, estados de carregamento/erro/vazio e indicação de pendência local. Dados já carregados em memória podem ser mostrados como desatualizados offline; não alegar cache remoto após reinício. Consultas de atividades não devem depender de uma resposta de indicadores globais, que o backend não isola por empresa.
4. Ao abrir atividade remota, consultar `GET /api/atividades/<id>` online, verificar novamente a associação antes de exibir detalhe e não enviar nenhuma mutação. Mostrar dados disponíveis, incluindo responsável, safra, datas, observações, custos e itens de insumos/máquinas quando existirem, sem oferecer controles de edição. Se indisponível, informar e permitir nova tentativa. Para atividade local ainda não confirmada, mostrar apenas os dados locais e o estado da fila, sem confundi-la com uma atividade do servidor.
5. Manter o formulário básico existente e `status: Planejada`; mapear categoria, tipo, talhão, empresa e propriedade verificados, responsável opcional conforme backend, data inicial, safra, custo e observações. O web exige responsável, mas o backend e o fluxo mobile atual permitem ausência: preservar esse comportamento e identificá-lo como opcional. Aplicar os limites de data, tamanho e custo do contrato e conferir relação tipo/categoria. Verificar duplicidade visível por tipo, talhão e data como orientação, sem afirmar que a verificação local substitui a regra do servidor ou cobre alterações concorrentes/offline. Não inferir que dados de apoio estejam disponíveis após reinício offline.
6. Preservar a fila transacional, bloqueio de envio simultâneo e classificação de rejeição e resultado incerto. Nunca reenviar automaticamente um POST de resultado desconhecido. Após confirmação com ID, combinar local e servidor somente pelo ID confirmado, manter uma representação local identificada quando a leitura remota falhar e evitar duplicação ao chegar o registro remoto. Não deduplicar por nome, data ou tipo nem reconciliar automaticamente resultados incertos.
7. Uma falha de recarga após confirmação não altera o resultado do envio e oferece apenas nova leitura. Não exibir detalhes internos de erros ou credenciais. A validação manual começa por consultas somente leitura com a usuária; antes de criar atividade real, confirmar explicitamente empresa/propriedade, talhão, categoria, tipo, data e demais valores e avisar que o cadastro é enviado automaticamente quando online.

## Risks / Trade-offs

- O backend analisado não demonstra autenticação ou isolamento por empresa nas rotas; mesmo com filtros, dados chegam ao cliente. A proteção real exige trabalho no servidor, fora deste escopo.
- Registros web com empresa nula só podem aparecer quando a cadeia talhão → propriedade → empresa for verificável; registros inconsistentes permanecerão ocultos até correção por meio apropriado.
- A criação sem chave de idempotência pode ter resultado incerto. Sem reconciliação manual, bloquear reenvio automático é mais seguro que tentar novamente.
- O web possui recursos além do formulário mobile básico. Status, edição, insumos, máquinas e movimentação de estoque não serão simulados ou parcialmente enviados nesta etapa.
