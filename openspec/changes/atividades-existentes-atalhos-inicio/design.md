# Design

## Contexto

O mobile já contém `loadActivities`, que consulta atividades, propriedades e talhões após verificar a sessão, e apresenta uma lista, detalhes e até três atividades na tela inicial. O filtro exige vínculos íntegros com a empresa e admite `id_empresa` nulo. A consulta ainda não foi comparada com uma atividade real específica no dispositivo. Portanto, a ausência relatada deve ser investigada, e não tratada como prova de um defeito específico.

A seção atual **Atalhos rápidos** já navega para nova atividade, talhões, financeiro e sincronização, usando botões textuais. A referência mostra cartões com ícones para nova atividade, talhões, financeiro e insumos, além de um acesso **Atividades**. A tela financeira atual não oferece uma lista de insumos.

## Objetivos e limites

**Objetivos:** mostrar atividades existentes do backend corretamente, facilitar a navegação e aproximar os atalhos da referência sem perder a sincronização.

**Fora do escopo:** construir um módulo de insumos, alterar o backend ou web, criar ou modificar registros reais, oferecer edição ou exclusão de atividades, alterar status, movimentar estoque ou prometer cache remoto persistente.

## Decisões

1. Antes de alterar a lógica, confirmar que o app no aparelho usa o bundle atual e comparar, com autorização da usuária e somente por leitura, uma atividade existente identificada por ela com as respostas de atividades, propriedades e talhões e com a tela mobile. Conferir também rede, sessão, erros e possíveis formatos diferentes dos IDs ou dos vínculos. Não registrar credenciais nem dados sensíveis nos logs. Se a atividade não for identificada ou a consulta real não estiver disponível, documentar o limite e não declarar a integração real validada.
2. Corrigir a causa comprovada por contrato e testes. Preservar a validação de empresa e vínculos, inclusive empresa nula; não incluir registros de outra empresa nem relaxar a validação apenas para preencher a tela. Vínculos ausentes ou inconsistentes devem ser tratados de forma explícita e segura, sem expor dados de terceiros. O filtro de interface não é mecanismo de segurança do servidor.
3. Na lista, apresentar todos os registros remotos elegíveis e os locais conforme o fluxo existente, com busca e detalhe. Distinguir carregamento, ausência de resultados, falha e dados desatualizados. Atualizar deve fazer apenas leitura e manter a reconciliação pelo ID confirmado, sem reenviar POST.
4. Na tela inicial, exibir uma prévia recente baseada em ordenação por data de início com desempate determinístico por ID; definir tratamento previsível para datas ausentes ou inválidas. O acesso **Atividades** abre a lista completa, inclusive quando não houver dados. A prévia não deve herdar silenciosamente uma pesquisa anterior da lista.
5. Criar uma linha de cartões com ícones, rótulos legíveis, fundos coloridos e navegação acessível, adaptada ao espaço disponível e rolável horizontalmente quando necessário. **Nova atividade**, **Talhões** e **Financeiro** usam os destinos existentes; financeiro respeita as permissões atuais. **Insumos** comunica que a funcionalidade ainda não está disponível, sem executar uma operação nem redirecionar a uma tela incorreta.
6. Manter a sincronização acessível e seus estados visíveis, sem removê-la quando o quarto cartão passar a ser **Insumos**. Não introduzir envio adicional, alterar a fila ou prometer acesso offline que não existe.
7. Testar contratos simulados, a causa corrigida, prévia, busca, navegação, acessibilidade, responsividade e estados de rede. A validação física deve conferir lista e detalhe de uma atividade autorizada, sem criar nem alterar dados. Dados reais não são necessários nos testes automatizados.

## Riscos

- O backend analisado não demonstra isolamento por empresa em todas as rotas: filtrar no cliente não protege os dados devolvidos pela API.
- Dados antigos podem possuir associações incompletas ou inconsistentes; não é seguro atribuir empresa por nome ou supor que toda atividade deva aparecer.
- Um atalho de insumos visualmente semelhante aos demais pode sugerir funcionalidade existente; o estado indisponível deve ser explícito.
