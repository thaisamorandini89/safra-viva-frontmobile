# Tarefas

## 1. Contratos e segurança

- [x] 1.1 Conferir logo SVG do web, telas mobile e opções de renderização local acessível.
- [x] 1.2 Conferir endpoints, payloads, catálogos, regras de estoque e limitações reais do backend e do web.
- [x] 1.3 Verificar autenticação, autorização e isolamento por empresa no servidor; registrar bloqueios e política de insumos sem propriedade, sem supor que filtro cliente forneça segurança.

## 2. Identidade visual

- [x] 2.1 Adaptar o logo web como recurso local compartilhado e apresentá-lo no login, início e cabeçalhos.
- [ ] 2.2 Validar contraste, acessibilidade, telas pequenas e funcionamento offline.

## 3. Consulta de insumos

- [x] 3.1 Implementar leitura isolada, validação de sessão e filtro por propriedade verificável, com estados de rede e erro.
- [x] 3.2 Implementar lista, busca, filtros, detalhe e lotes; ligar o atalho e a navegação de Insumos sem quebrar os demais atalhos.
- [ ] 3.3 Mostrar indicadores e relatórios sustentados pelos dados disponíveis, identificando dados desatualizados e recursos não suportados.

## 4. Cadastro e estoque

- [x] 4.1 Implementar cadastro e edição com catálogos, propriedade autorizada, produto existente ou novo, validações e estoque inicial conforme backend.
- [x] 4.2 Implementar exclusão com confirmação e tratamento de restrições; proteger alterações em produtos compartilhados.
- [ ] 4.3 Implementar histórico e formulário de entrada/saída com lotes e referências verificadas.
- [x] 4.4 Tratar indisponibilidade offline, envio duplicado, resultado incerto e falha de recarga sem reenvio automático.

## 5. Verificação

- [ ] 5.1 Adicionar testes para acessibilidade, marca, vínculos por empresa, listas, filtros, estados de rede e ausência de dados demonstrativos.
- [ ] 5.2 Testar contratos e validações de cadastro, edição, exclusão e movimentação, incluindo duplicidade, rejeição, confirmação e resultado incerto.
- [x] 5.3 Executar testes, tipos e lint; atualizar documentação do app e limitações.
- [ ] 5.4 Conferir visual e consultas no aparelho com dados existentes; solicitar confirmação específica antes de qualquer escrita real.

O backend analisado não exige autenticação nem filtra empresa nas rotas de insumos e movimentações, e o catálogo de produtos é global. O filtro mobile não corrige essa exposição: o uso em produção continua bloqueado até a correção no servidor. Insumos sem propriedade verificável permanecem ocultos.

O app oferece cadastro básico, edição de mínimo, valor e status, exclusão e movimentações online com seleção opcional de lote. Fabricante, fornecedor, marca e outras referências, além de relatórios completos do web, ainda não foram implementados. A marca é uma adaptação nativa do símbolo vetorial; a comparação visual no dispositivo permanece pendente. O bloqueio de resultado incerto é mantido somente durante a sessão do app.

Foram executados 118 testes, além de tipos e lint. Os testes de insumos cobrem filtro de empresa, detalhe, cadastro, edição, exclusão, movimentos, lote, falha de recarga, envio duplicado e resultado incerto; a cobertura completa dos demais campos e a conferência física continuam pendentes.
