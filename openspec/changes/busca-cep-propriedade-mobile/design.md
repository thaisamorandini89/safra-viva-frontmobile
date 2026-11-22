# Design

## Context

O formulário mobile usa os catálogos `GET /api/estados` e `GET /api/estados/<id>/cidades`. O backend analisado salva endereço na criação de propriedade apenas quando recebe CEP, `id_cidade` e logradouro; não foi localizada rota de consulta de CEP. O formulário web consulta diretamente o ViaCEP e relaciona UF e localidade aos catálogos do backend. A mudança depende do cadastro de propriedade já implementado em `cadastro-propriedades-talhoes-mobile`.

## Goals / Non-Goals

**Goals:**
- Reaproveitar o fluxo do web sem adicionar uma rota ou exigir mudanças no backend.
- Evitar perda de informação e seleção incorreta de município sob falha, edição simultânea ou resposta atrasada.
- Manter seleção e correção manuais como alternativa explícita.

**Non-Goals:**
- Alterar web, backend, cadastro de talhão ou regras de criação da propriedade.
- Consultar CEP automaticamente a cada tecla, introduzir consulta offline ou preencher coordenadas por geocodificação.
- Criar registros em testes automatizados ou sem confirmação da usuária.

## Decisions

1. **Transporte:** consulta explícita via HTTPS `GET https://viacep.com.br/ws/{cep}/json/`, com oito dígitos e timeout. Usar transporte específico separado de `BackendClient`: o endereço externo não recebe token nem origem do servidor da sessão. Como alternativa, um proxy no backend permitiria centralização, mas não existe no código analisado e altera o escopo.
2. **Dados:** tratar `erro`, resposta HTTP inválida, JSON incompleto e falhas de rede separadamente dos dados válidos. Aproveitar `logradouro` e, quando informado, `bairro`; preservar valores ausentes. Não supor que ViaCEP retorna ID interno da cidade.
3. **Mapeamento geográfico:** identificar UF no catálogo de estados e consultar as cidades desse estado. Comparar nome da localidade com os nomes retornados pelo backend, após normalização conservadora de caixa e espaços. Selecionar somente uma correspondência única. Na ausência, ambiguidade ou indisponibilidade, avisar e permitir seleção manual; nunca tratar código IBGE como ID interno sem contrato que o comprove.
4. **Conflitos:** campos de endereço vazios podem ser preenchidos automaticamente. Se campos ou seleção de estado/cidade já tiverem valores conflitantes, preservar valores existentes e apresentar sugestões com ação explícita para aplicá-las; ao confirmar, atualizar estado e cidade de forma coerente. Ao mudar o estado manualmente, limpar a cidade selecionada como atualmente.
5. **Concorrência:** guardar o CEP normalizado, uma geração para cada solicitação e revisão dos campos no início. Invalidar a geração quando o CEP mudar ou o formulário for fechado. Descartar respostas antigas; dados editados durante a consulta só podem ser substituídos mediante confirmação explícita. Garantir que o carregamento assíncrono de cidades também respeite a geração e a seleção atual.
6. **Falhas:** mostrar estados de carregamento, não encontrado e indisponível, permitindo nova tentativa. A funcionalidade é online, sem fila; os dados digitados permanecem em memória durante a sessão. A regra atual de endereço parcial continua exigindo CEP, cidade e logradouro, mas endereço inteiramente vazio segue opcional.

## Risks / Trade-offs

- [Consulta externa] → O CEP é transmitido ao ViaCEP; documentar a dependência e não enviar credenciais. Acesso à internet e ao backend podem falhar de forma independente.
- [Nomes diferentes ou catálogos incompletos] → Não adivinhar IDs e orientar seleção manual; testes devem cobrir ausência e ambiguidade.
- [Confirmação adicional em caso de conflito] → Evita substituir silenciosamente dados inseridos pela pessoa.
- [Conexão lenta] → Timeout e invalidação das respostas antigas impedem carregamento indefinido e alterações fora de contexto.

## Migration Plan

Adicionar a busca ao formulário existente e executar testes simulados e verificações do mobile. Testar no dispositivo com um CEP de teste informado ou confirmado pela usuária; não salvar propriedade real sem autorização. Em caso de regressão, retirar a busca e manter o preenchimento manual, sem migração de dados.
