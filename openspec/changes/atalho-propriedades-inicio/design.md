# Design

## Context

A tela inicial já exibe o cartão **Propriedades** com a quantidade carregada e possui navegação interna por estado de tela. A listagem existente é aberta pelo menu Mais e oferece cadastro e edição.

## Goals / Non-Goals

**Goals:** permitir tocar em qualquer parte do cartão de propriedades e abrir a listagem existente, com indicação de ação e acessibilidade.

**Non-Goals:** alterar outros cartões, criar telas ou endpoints, modificar os dados da lista ou ampliar o suporte offline.

## Decisions

1. Substituir o contêiner do cartão por um componente acionável, mantendo o layout e o indicador de quantidade atuais. Usar o mesmo destino de navegação do menu Mais.
2. Adicionar indicação visual discreta de acesso à lista, papel de botão e rótulo acessível compreensível; preservar área de toque adequada.
3. Permitir a navegação mesmo sem propriedades ou sem dados disponíveis. A tela de listagem continua responsável por mostrar seus estados existentes; o atalho não inicia nova requisição nem promete acesso offline a dados não carregados.
4. Verificar por testes de interface que o cartão abre a lista correta e que a quantidade e os estados anteriores permanecem visíveis.

## Risks / Trade-offs

- A listagem pode exibir dados indisponíveis quando não houver conexão ou carregamento concluído; o atalho não altera esse comportamento.
