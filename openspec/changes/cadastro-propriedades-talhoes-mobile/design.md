# Design

## Context

O mobile usa `BackendClient`, a sessão em memória e listas filtradas pela empresa na interface. As rotas de criação devolvem apenas identificador e nome, não o objeto completo. As rotas de propriedade e talhão analisadas não autenticam nem isolam os dados por empresa no servidor. A proposta altera somente o mobile, sem afirmar que essas rotas são seguras para produção.

O backend exige, para propriedade, `nome_propriedade`, `id_empresa`, `car`, `latitude`, `longitude`, `area_total`, `area_agricultavel` e `area_preservacao`. O endereço só é criado quando CEP, ID da cidade e logradouro são enviados juntos. Para talhão, exige `nome_talhao`, `codigo_talhao`, `id_propriedade` e `area_total`; usa a área total como área utilizável padrão e `Livre` como status inicial padrão. O web converte seus nomes de formulário para os nomes reais da API, inclusive ID de tipo de solo.

## Goals / Non-Goals

**Goals:**
- Oferecer criação de propriedade e talhão com interface consistente com o mobile e campos relevantes do web.
- Usar a empresa da sessão e propriedades pertencentes a ela, sem aceitar um ID arbitrário digitado.
- Tratar respostas, validação, duplicação potencial e atualização de dados de forma explícita.
- Testar contratos com respostas simuladas e depois confirmar o fluxo no dispositivo físico com dados de teste autorizados.

**Non-Goals:**
- Alterar backend ou web; criar registros de teste sem dados e confirmação da usuária.
- Implementar edição, exclusão, mapas, captura de GPS, persistência de rascunhos ou fila offline de propriedades e talhões.
- Alegar proteção multiempresa somente pelo mobile ou reenviar automaticamente uma criação de resultado desconhecido.

## Decisions

1. **Cadastro online:** usar os endpoints REST existentes e a sessão atual; verificar sessão e conexão antes do envio. Offline, manter o formulário aberto em memória e explicar que é necessário reconectar; não enfileirar como atividade. Persistência após fechamento não é garantida.
2. **Propriedade:** obter `id_empresa` da sessão, sem seleção de outra empresa. Exibir os campos obrigatórios do backend, CCIR, NIRF, ponto de referência, áreas opcionais, altitude, solo, classe de uso, endereço e observações. Consultar estados, cidades, tipos de solo e classes de uso quando necessários; não bloquear campos obrigatórios se um catálogo opcional falhar. Para endereço, pedir CEP, cidade e logradouro juntos e avisar que endereço parcial não será enviado. Coordenadas são informadas manualmente neste escopo.
3. **Talhão:** listar somente propriedades já carregadas da empresa atual. Mapear campos da interface para `nome_talhao`, `codigo_talhao`, `id_propriedade`, `area_total`, `area_utilizavel`, `status_inicial`, `id_tipo_solo`, `topografia`, `latitude`, `longitude` e `observacoes`. Selecionar tipo de solo por ID, sem usar o texto como identificador. Se não houver propriedade, orientar a criá-la primeiro.
4. **Validação:** normalizar números locais antes do envio; exigir áreas totais positivas, demais áreas não negativas e área utilizável até a área total; verificar coordenadas em seus intervalos e apresentar erros junto aos campos. Não fazer afirmações de unicidade garantida pelo servidor. Campos em branco opcionais são omitidos, salvo quando o contrato exigir outro valor.
5. **Resultado:** bloquear submissões simultâneas. Em `201`, guardar o ID retornado, informar sucesso e recarregar os dados relevantes; falha na atualização posterior não muda o resultado para erro de criação nem provoca novo POST. Em erros de validação ou rejeição explícita, preservar dados e permitir correção. Em timeout, perda de conexão ou resposta de resultado desconhecido, bloquear novo envio daquele formulário e orientar a consultar a lista antes de decidir criar novamente; sem idempotência não há garantia automática de deduplicação.
6. **Segurança:** continuar enviando o token quando presente, conferir a sessão e filtrar os dados pela empresa para limitar erros de uso. Isso não substitui autenticação, autorização e isolamento no backend. Não registrar credenciais ou tokens em logs e não expor detalhes internos de erros 500.

## Risks / Trade-offs

- As rotas de leitura e criação podem aceitar empresas e propriedades de terceiros: implantação segura depende de alterações futuras no backend, fora deste escopo.
- A API não oferece chave de idempotência; resultados incertos exigem reconciliação manual, pois uma nova tentativa pode duplicar dados.
- O endereço parcial é ignorado pelo serviço; o formulário deve deixar a condição clara, sem fingir que foi salvo.
- Sem GPS ou mapa, a pessoa deve informar latitude e longitude da propriedade manualmente. Os catálogos podem estar indisponíveis e devem ter estados de erro explícitos.
- A criação online não amplia o suporte offline atual: não há armazenamento de rascunho após encerrar o aplicativo.
