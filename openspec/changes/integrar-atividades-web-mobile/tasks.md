# Tasks

## 1. Contratos e carregamento

- [ ] 1.1 Conferir respostas reais e simuladas de atividades, talhões, propriedades, categorias, tipos e responsáveis sem expor dados sensíveis.
- [x] 1.2 Implementar carregamento independente de consultas não relacionadas e estados de carregamento, falha e nova leitura.
- [x] 1.3 Validar vínculos de empresa, propriedade e talhão, incluindo empresa nula e rejeição de associações inconsistentes.

## 2. Consulta e cadastro

- [x] 2.1 Atualizar listagem e busca, com indicação de dados remotos, locais, desatualizados e indisponíveis.
- [x] 2.2 Criar detalhe acessível de atividades remotas por ID e de registros locais, sem mutação.
- [x] 2.3 Revisar formulário básico, validações e payload contra o backend, mantendo responsável opcional e status planejado.
- [x] 2.4 Preservar e apresentar registros após sincronização, conciliando apenas IDs confirmados e permitindo recarregar sem reenviar POST.
- [x] 2.5 Manter estados e bloqueios da fila em rejeição, erro e resultado incerto; documentar limites de segurança e offline.

## 3. Verificação

- [x] 3.1 Adicionar testes para atividades do web com empresa nula, vínculos inconsistentes, falhas independentes, busca, detalhe e criação.
- [x] 3.2 Testar sincronização, falha de recarga, deduplicação por ID confirmado, fila pendente, rejeição, resultado incerto e regressões; executar testes, tipos e lint.
- [ ] 3.3 Com confirmação da usuária, conferir uma atividade existente no aparelho e no backend somente por leitura.
- [ ] 3.4 Antes de criação real, confirmar dados, associação e ciência do envio automático; testar somente se autorizado e conferir resultado no web/backend.
