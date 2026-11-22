# Proposal

## Why

A usuária deseja acessar no mobile as atividades já cadastradas no web e registrar novas atividades usando o backend existente. O mobile já tem listagem, formulário simplificado e fila offline, mas a integração precisa ser revista: o web não envia `id_empresa` ao criar uma atividade, enquanto a listagem mobile exige esse campo, o que pode ocultar registros válidos. Além disso, a listagem não abre detalhes e o carregamento de atividades depende de outras consultas em conjunto.

## What Changes

- Exibir no mobile as atividades reais do backend também criadas pelo web, respeitando a associação verificável com as propriedades da empresa da sessão, inclusive registros legados sem `id_empresa`.
- Oferecer listagem acessível, busca, atualização e detalhes de leitura, com estados distintos para carregamento, vazio, falha e dados locais pendentes.
- Revisar o cadastro já existente contra o contrato do backend e as regras pertinentes do formulário web, preservando a criação local e a fila de sincronização.
- Atualizar a listagem após sincronização sem duplicar ou esconder registros locais antes de confirmar a leitura do servidor.
- Cobrir contratos, filtro de empresa, navegação, validação, falhas e sincronização com testes simulados; conferir no dispositivo sem criar nem alterar dados reais sem autorização explícita.

## Capabilities

### New Capabilities

- `integracao-atividades-web-mobile`: consulta, detalhe e cadastro básico de atividades entre web, backend e mobile.

### Modified Capabilities

Nenhuma especificação principal será alterada: o fluxo atual de fila offline será preservado e complementado pela nova capacidade.

## Impact

- Mobile: tela inicial, listagem, detalhe, cadastro, carregamento, reconciliação de registros e testes.
- Backend existente: `GET /api/atividades`, `GET /api/atividades/<id>`, `POST /api/atividades`, catálogos de categorias e tipos, talhões, propriedades e responsáveis. Nenhuma alteração no backend ou web está prevista.
- A leitura dos registros web depende de associação íntegra entre atividade, talhão e propriedade. A API analisada não demonstra autenticação nem isolamento por empresa nessas rotas; o filtro no mobile não é proteção no servidor.
- Edição, exclusão, alteração de status e cadastro de insumos ou máquinas em atividades não fazem parte desta etapa; ações que concluam atividades podem movimentar estoque e exigem proposta própria.
