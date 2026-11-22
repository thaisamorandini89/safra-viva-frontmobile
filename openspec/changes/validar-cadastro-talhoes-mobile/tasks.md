# Tasks

## 1. Revisão da integração existente

- [x] 1.1 Conferir formulário, campos, validações e POST de talhão contra o backend atual.
- [x] 1.2 Revisar atualização da listagem e do seletor de atividades, bem como rejeição e resultado incerto.
- [x] 1.3 Corrigir apenas divergências identificadas e acrescentar testes automatizados pertinentes, se necessário.

## 2. Atalho e edição

- [x] 2.1 Tornar o cartão de talhões da tela inicial acionável, preservando quantidade e acessibilidade.
- [x] 2.2 Tornar os cartões da lista acionáveis, carregar o registro por ID e conferir a propriedade e a empresa da sessão.
- [x] 2.3 Reaproveitar o formulário para edição com campos preenchidos, validação, confirmação de descarte e propriedade vinculada imutável.
- [x] 2.4 Enviar alterações parciais ao backend; tratar resultado, recarga, falhas, concorrência e valores opcionais sem perda de dados.
- [x] 2.5 Adicionar ícones e rótulos acessíveis aos comandos de edição, salvar e voltar.

## 3. Verificação

- [x] 3.1 Cobrir atalho, carregamento, edição, validação, catálogos, erros, preservação de dados e regressões de cadastro; executar testes, tipos e lint.
- [ ] 3.2 Solicitar e confirmar a propriedade e os dados de teste antes de qualquer cadastro ou alteração real.
- [ ] 3.3 No dispositivo físico, criar e editar somente os registros autorizados e conferir sua associação na listagem e no backend.
- [ ] 3.4 Confirmar a disponibilidade no seletor de atividades sem salvar uma atividade; registrar resultados e limitações.
