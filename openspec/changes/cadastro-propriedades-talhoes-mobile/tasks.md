# Tasks

## 1. Contratos e validação

- [x] 1.1 Modelar DTOs e mapeamentos dos dois POSTs e dos catálogos, verificando os nomes e identificadores com testes de contrato simulados.
- [x] 1.2 Implementar normalização de números e validação de áreas, coordenadas e endereço, com testes de valores válidos, inválidos e opcionais.
- [x] 1.3 Tratar erros HTTP sem expor detalhes internos e testar validação, autorização e falha de rede.

## 2. Cadastro de propriedade

- [x] 2.1 Adicionar acesso e formulário responsivo com campos obrigatórios e opcionais do backend; verificar navegação, validação e estados dos catálogos em testes de interface.
- [x] 2.2 Enviar a empresa da sessão e os campos válidos, atualizar propriedades e seletores após `201` e testar que falha de recarga não repete a criação.
- [x] 2.3 Testar ausência ou troca de empresa, endereço parcial, seleção de catálogos e recuperação de erros sem perda do formulário.

## 3. Cadastro de talhão

- [x] 3.1 Adicionar acesso e formulário com propriedade da sessão, nome, código, áreas e campos opcionais; testar formulário vazio, validação e ausência de propriedade.
- [x] 3.2 Integrar o POST com IDs do backend e atualizar lista e seletor de atividades; testar payload, sucesso e falha de recarga.
- [x] 3.3 Testar que propriedades de outras empresas não aparecem nas opções e que a área utilizável padrão respeita o contrato.

## 4. Estados e integração

- [x] 4.1 Bloquear envios simultâneos e reenvio automático em resultado incerto; testar timeout, desconexão e orientação de reconciliação manual.
- [x] 4.2 Documentar cadastro somente online, ausência de rascunho persistente e risco de autorização no backend; conferir documentação com o comportamento implementado.
- [x] 4.3 Rodar testes e verificações de tipos e lint do mobile; registrar os resultados e eventuais limitações. (50 testes aprovados com backend simulado; TypeScript e lint sem erros.)
- [ ] 4.4 Com dados de teste fornecidos e confirmados pela usuária, cadastrar propriedade e talhão no dispositivo físico e verificar suas listas e a seleção na atividade, sem duplicar registros em caso de resultado incerto.
