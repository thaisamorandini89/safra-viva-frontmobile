# Proposta: identidade visual e insumos no mobile

## Por quê

O aplicativo precisa apresentar a marca SafraViva usada no sistema web e disponibilizar no celular os insumos cadastrados e suas operações de estoque. Atualmente o atalho de insumos informa indisponibilidade.

## O que muda

- Reutilizar a identidade visual do logo web no login, na tela inicial e nos cabeçalhos das telas, adaptando tamanho e contraste ao celular.
- Abrir Insumos pelo atalho rápido e por uma opção identificável na navegação, com listagem, busca, filtros, detalhe e recarga dos insumos existentes elegíveis.
- Oferecer cadastro, edição e exclusão com confirmação, seguindo os contratos e validações existentes; os dados de propriedade devem ser verificáveis para a empresa da sessão.
- Oferecer consulta de lotes e histórico, além de entradas e saídas de estoque, respeitando o contrato do backend. Refletir os dados confirmados pelo servidor e informar resultados incertos.
- Apresentar indicadores e relatórios de estoque que possam ser calculados com dados reais disponíveis, sem simular funções que o backend não suporte.

## Capacidades

### Novas capacidades

- `identidade-visual-mobile`: marca do sistema web aplicada de modo consistente e acessível no app.
- `insumos-mobile`: consulta, cadastro e gestão de insumos e movimentações com o backend existente.

### Capacidades modificadas

A proposta substitui a indisponibilidade do atalho de Insumos descrita na mudança `atividades-existentes-atalhos-inicio`, quando as funcionalidades estiverem prontas. As demais navegações e a fila de sincronização permanecem preservadas.

## Impacto e limites

- Alterações previstas somente no mobile, documentação e testes; usar backend e web existentes como referência, sem modificá-los.
- O backend admite insumos sem propriedade e lista todos os registros. A proposta não presume que tais itens pertençam à empresa: enquanto não houver regra segura, somente vínculos verificáveis serão exibidos e manipulados.
- O filtro no cliente não garante isolamento ou autorização no servidor; a proteção multiempresa deve ser verificada e corrigida no backend antes de uso com dados sensíveis se ainda não for garantida.
- Validação real começa por leitura. Cadastro, alteração, exclusão e movimentação reais exigem confirmação específica dos dados e da operação pela usuária.
