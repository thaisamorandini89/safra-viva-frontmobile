# Design

## Context

Os cartões da lista atualmente não são interativos. O formulário de criação já possui validação, seleção de catálogos e consulta de CEP. O backend retorna os dados completos, inclusive endereço aninhado, por `GET /api/propriedades/<id>` e aceita atualização parcial por `PUT /api/propriedades/<id>`, respondendo com ID e nome, não o objeto completo.

O serviço atual só atualiza o endereço quando recebe CEP, cidade e logradouro juntos; nessa situação cria um novo logradouro. Não há contrato identificado para remover o endereço por esse PUT. As rotas examinadas não aplicam autenticação e autorização por empresa.

## Goals / Non-Goals

**Goals:**
- Abrir um registro a partir da lista e editar os dados suportados sem alterar a empresa vinculada.
- Mostrar ícones com texto e acessibilidade nas ações do fluxo de propriedades.
- Preservar campos não alterados, inclusive endereço, e comunicar o resultado real do salvamento.

**Non-Goals:**
- Alterar backend ou web, editar talhões, excluir propriedades ou remover endereço existente.
- Implementar sincronização offline, controle de concorrência no servidor ou afirmar isolamento multiempresa.
- Expandir a revisão visual a todas as telas do aplicativo sem definição adicional.

## Decisions

1. **Navegação e dados:** tornar o cartão inteiro acionável, com indicação de edição; buscar o registro por ID e exibir carregamento, erro e nova tentativa. Verificar a empresa da sessão e do registro retornado antes de permitir a edição, sem oferecer troca de empresa. Tratar registro removido ou não pertencente à empresa sem abrir formulário editável.
2. **Formulário:** reutilizar os campos, validações e busca de CEP existentes com modos explícitos de criação e edição. Inicializar estado e cidade pelo endereço retornado e manter os IDs reais de catálogos; falhas de catálogo não devem apagar valores existentes. Pedir confirmação antes de descartar alterações ao voltar.
3. **Payload:** enviar apenas campos alterados e permitidos, convertidos conforme o contrato; omitir `id_empresa`, status e dados não editados. Preservar zero e permitir limpar campos opcionais apenas quando o backend suportar esse comportamento. Quando qualquer parte do endereço mudar, validar e enviar CEP, ID da cidade e logradouro juntos com os demais dados atuais do endereço. Se endereço não mudar, omitir todos os seus campos para não criar logradouro desnecessário. Não oferecer remoção de endereço, pois não há contrato correspondente.
4. **Resultado:** exigir conexão; impedir envio simultâneo. Após HTTP 200, informar sucesso e recarregar propriedades e seletores. Se a atualização da lista falhar, manter a confirmação e oferecer nova tentativa de leitura, sem repetir o PUT. Em rejeição explícita, preservar os dados. Em perda de conexão ou resposta incerta após envio, não repetir automaticamente; orientar a consultar o registro atualizado antes de tentar novamente.
5. **Concorrência:** o backend não informa versão ou ETag; o formulário deve enviar apenas campos alterados para reduzir sobrescritas, mas não garante detecção de mudanças concorrentes no mesmo campo. Respostas atrasadas após navegação ou alteração de CEP não devem substituir dados atuais.
6. **Ícones:** usar uma abordagem compatível com as dependências e o ambiente nativo existentes; escolher símbolos consistentes para nova propriedade, edição, busca, salvar e voltar. Manter rótulos textuais, nomes acessíveis e alvos de toque adequados; não depender exclusivamente de cor ou ícone. Evitar nova dependência nativa sem necessidade.

## Risks / Trade-offs

- O filtro por empresa no aplicativo não protege a API contra acesso direto; é necessária autorização no servidor antes de uso seguro em produção.
- Cada atualização de endereço completo cria um novo logradouro no backend; omitir endereço inalterado evita criações desnecessárias, mas não corrige o comportamento do servidor.
- Sem versão no backend, edições concorrentes do mesmo campo podem sobrescrever umas às outras.
- Uma confirmação perdida pode significar que o PUT foi aplicado; a reconciliação exige consultar o servidor antes de tentar novamente.
