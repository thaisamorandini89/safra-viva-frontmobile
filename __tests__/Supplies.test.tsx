import React, { useState } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SuppliesScreen } from '../src/ui/SuppliesScreen';
import {
  loadSupplies,
  loadVerifiedSupply,
} from '../src/app/supplies/supplyData';
import {
  BackendError,
  type BackendClient,
  type Usuario,
} from '../src/infra/api/BackendClient';
import type { Connectivity } from '../src/app/sync/connectivity';

const user: Usuario = {
  id: 1,
  nome: 'Pessoa',
  perfil: 'operador',
  id_empresa: 7,
};
const property = {
  id_propriedade: 3,
  id_empresa: 7,
  nome_propriedade: 'Fazenda',
};
const supply = {
  id_insumo: 10,
  id_produto: 11,
  id_propriedade: 3,
  nome_produto: 'Sementes',
  nome_propriedade: 'Fazenda',
  categoria_nome: 'Sementes',
  unidade_medida: 'kg',
  estoque_atual: 5,
  estoque_minimo: 8,
  valor_unitario: 3,
  status: true,
  lotes: [
    {
      id_lote: 4,
      numero_lote: 'L1',
      quantidade: 5,
      data_validade: '2027-01-01',
    },
  ],
};

function setup() {
  let properties = [
    property,
    { id_propriedade: 4, id_empresa: 8, nome_propriedade: 'Outra' },
  ];
  let detail = supply;
  let failList = false;
  let writeError: Error | null = null;
  const request = jest.fn(
    async (
      path: string,
      method?: string,
      _body?: unknown,
    ): Promise<unknown> => {
      if (method) {
        if (writeError) throw writeError;
        return { id_insumo: 10 };
      }
      if (path === '/propriedades') return properties;
      if (path === '/insumos') {
        if (failList) throw new Error('offline');
        return [
          supply,
          {
            ...supply,
            id_insumo: 20,
            id_propriedade: 4,
            nome_produto: 'Outra empresa',
          },
          {
            ...supply,
            id_insumo: 30,
            id_propriedade: null,
            nome_produto: 'Sem vínculo',
          },
        ];
      }
      if (path === '/insumos/10') return detail;
      if (path === '/categorias-insumo')
        return [
          { id_categoria_insumo: 2, nome_categoria: 'Sementes', status: true },
        ];
      if (path === '/produtos')
        return [
          {
            id_produto: 55,
            nome_produto: 'Produto livre',
            unidade_medida: 'kg',
            status: true,
          },
        ];
      if (path === '/movimentacoes?id_insumo=10')
        return [
          {
            id_movimentacao: 'mov-1',
            id_insumo: 10,
            tipo_movimentacao: 'ENTRADA',
            quantidade: 5,
            data_movimentacao: '2026-01-01',
          },
        ];
      throw new Error(`Rota inesperada: ${path}`);
    },
  );
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  return {
    client,
    request,
    failList: () => {
      failList = true;
    },
    setWriteError: (error: Error) => {
      writeError = error;
    },
    setDetail: (value: typeof supply) => {
      detail = value;
    },
    setProperties: (value: typeof properties) => {
      properties = value;
    },
  };
}

function Harness({
  client,
  connectivity = 'online',
}: {
  client: BackendClient;
  connectivity?: Connectivity;
}) {
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  return (
    <SuppliesScreen
      client={client}
      user={user}
      connectivity={connectivity}
      busy={busy}
      onBusyChange={setBusy}
      uncertain={uncertain}
      onUncertainChange={setUncertain}
    />
  );
}

async function render(
  client: BackendClient,
  connectivity: Connectivity = 'online',
) {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <Harness client={client} connectivity={connectivity} />,
    );
  });
  return renderer!;
}

async function press(
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
) {
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
  });
}

async function input(
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
  text: string,
) {
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: label })
      .props.onChangeText(text);
  });
}

test('lista apenas insumos com propriedade verificável e rejeita detalhe de outra empresa', async () => {
  const env = setup();
  const result = await loadSupplies(env.client, user);
  expect(result.items.map(item => item.id_insumo)).toEqual([10]);
  env.setDetail({ ...supply, id_propriedade: 4 });
  await expect(loadVerifiedSupply(env.client, user, 10)).rejects.toThrow();
  env.setProperties([property, { ...property, id_empresa: 8 }]);
  expect((await loadSupplies(env.client, user)).items).toEqual([]);
});

test('busca, filtro de estoque, lotes e histórico usam dados reais elegíveis', async () => {
  const env = setup();
  const renderer = await render(env.client);
  let tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('Sementes');
  expect(tree).not.toContain('Outra empresa');
  expect(tree).not.toContain('Sem vínculo');
  await input(renderer, 'Buscar insumos', 'inexistente');
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Nenhum insumo encontrado.',
  );
  await input(renderer, 'Buscar insumos', 'sementes');
  await press(renderer, 'Apenas estoque baixo');
  await press(renderer, 'Consultar insumo Sementes');
  tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('L1');
  expect(tree).toContain('ENTRADA');
  expect(env.request.mock.calls.filter(call => call[1])).toHaveLength(0);
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('cadastro envia propriedade verificada, produto e estoque inicial', async () => {
  const env = setup();
  const renderer = await render(env.client);
  await press(renderer, '+ Novo insumo');
  await press(renderer, 'Fazenda');
  await input(renderer, 'Nome do produto', 'Milho');
  await input(renderer, 'Unidade de medida', 'kg');
  await press(renderer, 'Sementes');
  await input(renderer, 'Estoque inicial', '5');
  await press(renderer, 'Salvar insumo');
  expect(env.request).toHaveBeenCalledWith('/insumos', 'POST', {
    produto: {
      nome_produto: 'Milho',
      unidade_medida: 'kg',
      id_categoria_insumo: 2,
    },
    id_propriedade: 3,
    estoque_minimo: 0,
    valor_unitario: 0,
    estoque_atual: 5,
    status: true,
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('Operação confirmada');
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('edição não envia saldo nem altera produto compartilhado', async () => {
  const env = setup();
  const renderer = await render(env.client);
  await press(renderer, 'Consultar insumo Sementes');
  await press(renderer, 'Editar insumo');
  await input(renderer, 'Estoque mínimo', '2');
  await press(renderer, 'Inativo');
  await press(renderer, 'Salvar insumo');
  expect(env.request).toHaveBeenCalledWith('/insumos/10', 'PUT', {
    estoque_minimo: 2,
    valor_unitario: 3,
    status: false,
  });
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('movimentação exige confirmação e resultado incerto bloqueia novas gravações', async () => {
  const env = setup();
  env.setWriteError(new Error('rede'));
  const renderer = await render(env.client);
  await press(renderer, 'Consultar insumo Sementes');
  await press(renderer, 'Saída de estoque');
  await input(renderer, 'Quantidade', '2');
  await press(renderer, 'Revisar e confirmar');
  expect(env.request.mock.calls.filter(call => call[1])).toHaveLength(0);
  await press(renderer, 'Confirmar movimentação');
  expect(env.request).toHaveBeenCalledWith('/movimentacoes', 'POST', {
    id_insumo: 10,
    tipo_movimentacao: 'SAIDA',
    quantidade: 2,
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('Resultado desconhecido');
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Revisar e confirmar' })
      .props.disabled,
  ).toBe(true);
  expect(env.request.mock.calls.filter(call => call[1])).toHaveLength(1);
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('saída selecionada envia somente lote do insumo verificado', async () => {
  const env = setup();
  const renderer = await render(env.client);
  await press(renderer, 'Consultar insumo Sementes');
  await press(renderer, 'Saída de estoque');
  await input(renderer, 'Quantidade', '2');
  await press(renderer, 'Lote L1 · 5 · validade 2027-01-01');
  await press(renderer, 'Revisar e confirmar');
  await press(renderer, 'Confirmar movimentação');
  expect(env.request).toHaveBeenCalledWith('/movimentacoes', 'POST', {
    id_insumo: 10,
    tipo_movimentacao: 'SAIDA',
    quantidade: 2,
    id_lote: 4,
  });
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('recusa quantidade com precisão maior que a aceita no estoque', async () => {
  const env = setup();
  const renderer = await render(env.client);
  await press(renderer, 'Consultar insumo Sementes');
  await press(renderer, 'Entrada de estoque');
  await input(renderer, 'Quantidade', '0,0001');
  await press(renderer, 'Revisar e confirmar');
  await press(renderer, 'Confirmar movimentação');
  expect(env.request.mock.calls.filter(call => call[1])).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).toContain('Informe uma quantidade');
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('falha de recarga não desfaz confirmação de uma movimentação', async () => {
  const env = setup();
  const original = env.request.getMockImplementation()!;
  env.request.mockImplementation(async (path, method, body) => {
    const result = await original(path, method, body);
    if (method === 'POST' && path === '/movimentacoes') env.failList();
    return result;
  });
  const renderer = await render(env.client);
  await press(renderer, 'Consultar insumo Sementes');
  await press(renderer, 'Saída de estoque');
  await input(renderer, 'Quantidade', '1');
  await press(renderer, 'Revisar e confirmar');
  await press(renderer, 'Confirmar movimentação');
  const text = JSON.stringify(renderer.toJSON());
  expect(text).toContain('Operação confirmada, mas a lista não foi atualizada');
  expect(text).not.toContain('Resultado desconhecido');
  expect(env.request.mock.calls.filter(call => call[1])).toHaveLength(1);
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('recusa de exclusão não é confundida com sucesso ou resultado incerto', async () => {
  const env = setup();
  env.setWriteError(new BackendError(400));
  const renderer = await render(env.client);
  await press(renderer, 'Consultar insumo Sementes');
  await press(renderer, 'Excluir insumo');
  expect(env.request.mock.calls.filter(call => call[1])).toHaveLength(0);
  await press(renderer, 'Confirmar exclusão');
  expect(JSON.stringify(renderer.toJSON())).toContain('servidor recusou');
  expect(JSON.stringify(renderer.toJSON())).not.toContain(
    'Resultado desconhecido',
  );
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('impede escrita quando vínculo mudou desde a abertura', async () => {
  const env = setup();
  const renderer = await render(env.client);
  await press(renderer, 'Consultar insumo Sementes');
  await press(renderer, 'Editar insumo');
  env.setDetail({ ...supply, id_propriedade: 4 });
  await press(renderer, 'Salvar insumo');
  expect(env.request.mock.calls.filter(call => call[1])).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Nenhuma operação foi enviada',
  );
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('não registra validade sem número de lote nem envia toques duplicados', async () => {
  const env = setup();
  let finish: (value: unknown) => void = () => undefined;
  const original = env.request.getMockImplementation()!;
  env.request.mockImplementation((path, method, body) =>
    method
      ? new Promise(resolve => {
          finish = resolve;
        })
      : original(path, method, body),
  );
  const renderer = await render(env.client);
  await press(renderer, 'Consultar insumo Sementes');
  await press(renderer, 'Entrada de estoque');
  await input(renderer, 'Quantidade', '3');
  await input(renderer, 'Validade AAAA-MM-DD (opcional)', '2027-01-01');
  await press(renderer, 'Revisar e confirmar');
  await press(renderer, 'Confirmar movimentação');
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Informe o número do lote',
  );
  expect(env.request.mock.calls.filter(call => call[1])).toHaveLength(0);
  await input(renderer, 'Número do lote (opcional)', 'L2');
  await ReactTestRenderer.act(async () => {
    const button = renderer.root.findByProps({
      accessibilityLabel: 'Confirmar movimentação',
    });
    button.props.onPress();
    button.props.onPress();
    await Promise.resolve();
  });
  expect(env.request.mock.calls.filter(call => call[1])).toHaveLength(1);
  await ReactTestRenderer.act(async () => {
    finish({ id_movimentacao: 'nova' });
  });
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('falha de leitura não inventa lista vazia e offline não faz pedidos', async () => {
  const env = setup();
  env.failList();
  const renderer = await render(env.client);
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Não foi possível carregar insumos',
  );
  expect(JSON.stringify(renderer.toJSON())).not.toContain(
    'Nenhum insumo encontrado.',
  );
  await ReactTestRenderer.act(async () => renderer.unmount());
  const offline = setup();
  const second = await render(offline.client, 'offline');
  expect(JSON.stringify(second.toJSON())).toContain(
    'Insumos do servidor indisponíveis',
  );
  expect(offline.request).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => second.unmount());
});
