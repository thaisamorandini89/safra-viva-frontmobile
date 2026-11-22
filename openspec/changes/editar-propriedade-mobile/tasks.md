# Tasks

## 1. Contratos e formulário

- [x] 1.1 Modelar e testar leitura detalhada e atualização parcial, incluindo verificação da empresa e tratamento de 404 e falhas.
- [x] 1.2 Reutilizar o formulário existente em modos criação e edição, carregando campos e catálogos sem apagar valores existentes.
- [x] 1.3 Montar payload somente com alterações, tratando zero, campos opcionais e endereço completo; preservar endereço inalterado e a busca de CEP.
- [x] 1.4 Validar campos e proteger alterações não salvas e respostas atrasadas.

## 2. Navegação e interface

- [x] 2.1 Tornar os cartões de propriedade acionáveis e apresentar carregamento, erro e nova tentativa.
- [x] 2.2 Adicionar ícones e texto acessível às ações de criar, editar, buscar CEP, salvar e voltar, respeitando o visual do mobile.
- [x] 2.3 Tratar conexão, rejeição, envio simultâneo, resultado incerto e atualização das listas e seletores após sucesso.

## 3. Verificação

- [x] 3.1 Cobrir abertura, edição, validação, preservação de endereço, catálogos, CEP, falhas e regressões de criação com testes simulados; executar testes, tipos e lint. (73 testes aprovados; tipos e lint sem erros.)
- [x] 3.2 Documentar limites de segurança, concorrência e edição online.
- [ ] 3.3 Testar em dispositivo físico; antes de salvar mudanças reais, solicitar autorização e identificar o registro e os dados de teste.
