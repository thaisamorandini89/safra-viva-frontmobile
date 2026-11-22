# Proposal

## Why

No cadastro de propriedade do mobile, o CEP e o endereço precisam ser preenchidos manualmente. A busca disponível no web pode reduzir a digitação e facilitar a seleção da cidade correta no celular.

## What Changes

- Acrescentar ao formulário de propriedade uma busca de CEP com botão, validação, indicação de carregamento e mensagens de resultado.
- Preencher logradouro e sugerir estado e cidade usando os catálogos existentes, mantendo os campos editáveis e o preenchimento manual quando a consulta falhar ou não houver correspondência.
- Evitar que respostas atrasadas ou incompletas substituam silenciosamente informações já digitadas ou associem a propriedade a uma cidade incorreta.
- Preservar a regra atual do backend para salvar o endereço: CEP, cidade e logradouro devem ser enviados juntos.

## Capabilities

### New Capabilities

- `consulta-cep-propriedade-mobile`: consulta online de CEP e preenchimento assistido do endereço no cadastro mobile de propriedade.

### Modified Capabilities

Nenhuma especificação principal existente é alterada; a capacidade de cadastros rurais ainda está em uma mudança OpenSpec em andamento.

## Impact

- Mobile: formulário de propriedade, integração de consulta de CEP, seleção de estado/cidade, testes e documentação.
- Como no web, a consulta será feita diretamente ao ViaCEP; o CEP informado será enviado a esse serviço externo, sem credenciais do backend. É necessária conexão com ele.
- Backend existente: `GET /api/estados`, `GET /api/estados/<id>/cidades` e `POST /api/propriedades`; não foram identificadas rotas de consulta de CEP no backend analisado. Não estão previstas alterações no backend nem no web.
- Depende do formulário implementado na mudança `cadastro-propriedades-talhoes-mobile`. Não cria registros reais durante a implementação ou os testes automatizados.
