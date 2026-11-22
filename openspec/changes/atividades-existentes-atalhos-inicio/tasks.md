# Tarefas

## 1. Diagnóstico

- [ ] 1.1 Conferir bundle instalado, sessão e caminho de navegação; identificar os estados de falha e os contratos já implementados.
- [ ] 1.2 Com autorização e identificação da usuária, comparar por leitura uma atividade real e seus vínculos no backend com o mobile, sem registrar credenciais ou criar dados.
- [ ] 1.3 Reproduzir a causa encontrada em teste simulado e corrigir a consulta ou apresentação preservando a validação de vínculos e empresa.

A prévia da tela inicial dependia indevidamente da busca anterior e foi corrigida. A causa de eventual ausência na lista completa ainda depende de conferência real. O modelo do backend permite propriedade nula, mas isso, por si só, não demonstra o motivo observado nem autoriza relaxar os vínculos.

Na conferência somente de leitura do servidor local, foi retornada uma atividade com talhão e propriedade coerentes e empresa nula. A lista mobile apareceu vazia. A comparação, por nomes únicos, das propriedades visíveis na sessão sugere que a propriedade da atividade pertence a outra empresa; a empresa da sessão não foi conferida diretamente pela API autenticada. Não foram criados nem alterados registros. Confirmar a associação e a política de acesso antes de modificar o filtro.

## 2. Atividades existentes

- [ ] 2.1 Garantir listagem, busca, detalhes e recarga dos registros elegíveis do backend, inclusive cadastrados no web, mantendo os registros locais e a reconciliação por ID.
- [x] 2.2 Melhorar a prévia da tela inicial, com ordenação determinística, estados claros e acesso à lista completa independente da busca anterior.

## 3. Atalhos da tela inicial

- [x] 3.1 Implementar cartões com ícones, rótulos e cores conforme a referência, adaptáveis à largura e acessíveis.
- [x] 3.2 Navegar para nova atividade, talhões e financeiro, respeitando permissões; informar claramente que insumos ainda não está disponível.
- [x] 3.3 Preservar acesso e estados da fila de sincronização e adicionar acesso direto à lista de atividades.
- [x] 3.4 Adicionar cartões de Atividades na grade inicial e nos atalhos rápidos, abrindo a lista sem manter a busca anterior e preservando o filtro por empresa. A quantidade considera apenas atividades do servidor e identifica dados possivelmente desatualizados.

## 4. Verificação

- [x] 4.1 Testar dados simulados do web, vínculos válidos e inconsistentes, estados de rede, busca, detalhe, ordenação e reconciliação.
- [ ] 4.2 Testar atalhos, acessibilidade, largura reduzida, indisponibilidade de insumos e acesso à sincronização; executar testes, tipos e lint.
- [ ] 4.3 Com confirmação da usuária, conferir a atividade identificada no dispositivo e no backend somente por leitura; não criar nem modificar dados reais.

Os testes automatizados verificam os atalhos, os rótulos acessíveis e a rolagem horizontal; 103 testes, tipos e lint passaram. A aparência e o alcance dos cartões em largura reduzida ainda precisam de conferência no aparelho.
