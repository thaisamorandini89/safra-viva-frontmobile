# Proposta: atividades existentes e atalhos na tela inicial

## Por quê

A usuária encontrou o cadastro de atividades, mas precisa visualizar no celular as atividades que já foram cadastradas no web. A integração anterior já implementa uma consulta e uma listagem, porém a conferência com registros reais no aparelho ainda está pendente. É necessário identificar por que os registros esperados não aparecem, sem presumir que o cadastro ou a API estejam corretos ou incorretos.

A tela inicial já possui atalhos textuais, mas eles não correspondem aos cartões com ícones, cores e organização apresentados nas imagens de referência.

## O que muda

- Investigar a consulta, a versão do app no aparelho, a sessão, as respostas reais e os vínculos dos registros esperados; corrigir a causa identificada para listar as atividades já cadastradas e abrir seus detalhes.
- Garantir acesso claro à lista completa pela tela inicial, além de uma prévia de atividades recentes e estados claros de carregamento, vazio, falha e dados desatualizados.
- Reformular **Atalhos rápidos** com cartões acessíveis para **Nova atividade**, **Talhões**, **Financeiro** e **Insumos**, conforme as imagens, incluindo acesso à listagem de atividades.
- Preservar acesso à sincronização e à fila existente. O atalho **Insumos** deve indicar claramente indisponibilidade enquanto não existir uma tela funcional, sem apontar para financeiro como se fosse uma lista de insumos.

## Capacidades

### Novas capacidades

- `atividades-existentes-atalhos-inicio`: consulta verificável de atividades existentes e atalhos visuais na tela inicial.

### Capacidades modificadas

Nenhuma especificação principal será alterada. Esta proposta complementa a mudança em andamento `integrar-atividades-web-mobile` e deve reutilizar sua implementação e seus testes, sem recriar a funcionalidade.

## Impacto

- Mobile: carregamento e apresentação de atividades, início, navegação, acessibilidade e testes.
- Backend existente: consulta de atividades, propriedades e talhões; nenhuma alteração de backend ou web está prevista.
- A leitura dos registros deve respeitar os vínculos verificáveis da empresa. O filtro no mobile não substitui autenticação e isolamento no backend.
- A conferência em dispositivo e backend começa por leitura mediante confirmação. Criação real, edição, mudança de status e movimentação de estoque não fazem parte desta proposta.
