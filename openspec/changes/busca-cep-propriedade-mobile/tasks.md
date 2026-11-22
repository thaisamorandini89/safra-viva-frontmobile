# Tasks

## 1. Consulta e contratos

- [x] 1.1 Implementar normalização e validação de CEP e testar oito dígitos, máscara e entradas inválidas sem requisição externa.
- [x] 1.2 Implementar consulta HTTPS isolada ao ViaCEP com timeout e sem token; testar sucesso, resposta parcial, CEP inexistente, HTTP inválido, JSON inválido e falha de rede.
- [x] 1.3 Mapear UF e localidade para IDs reais dos catálogos do backend; testar seleção única, cidade ausente, ambiguidade, nomes com diferenças de caixa/espaços e catálogo indisponível.

## 2. Formulário de propriedade

- [x] 2.1 Adicionar campo e botão de busca com carregamento e mensagens acessíveis; testar estados de consulta, erro, nova tentativa e edição manual.
- [x] 2.2 Preencher campos vazios e solicitar confirmação para sugestões conflitantes, preservando as edições; testar estado/cidade previamente selecionados, logradouro e bairro, inclusive respostas parciais.
- [x] 2.3 Invalidar respostas atrasadas após alteração de CEP, seleção manual, fechamento do formulário ou nova consulta; testar concorrência da busca e do carregamento de cidades.
- [x] 2.4 Preservar endereço opcional e validar CEP, ID de cidade e logradouro antes do POST; testar payload completo, endereço parcial e formulário sem endereço.
- [x] 2.5 Documentar dependência externa, envio do CEP ao ViaCEP, necessidade de conexão e preenchimento manual alternativo; conferir a documentação com o comportamento implementado.

## 3. Verificação integrada

- [x] 3.1 Rodar testes automatizados, verificação de tipos e lint do mobile; registrar os resultados e limitações. (65 testes aprovados com respostas simuladas; tipos e lint sem erros.)
- [ ] 3.2 Testar a busca em dispositivo físico com CEP de teste informado ou confirmado pela usuária; verificar preenchimento, seleção e falhas, sem criar propriedade sem autorização.
