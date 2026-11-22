import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';
import {
  buildPlotUpdate,
  loadPlot,
  plotFields,
  updatePlot,
} from '../src/app/cadastros/editPlot';
import {
  BackendError,
  type BackendClient,
  type Usuario,
} from '../src/infra/api/BackendClient';
import type { LocalDb } from '../src/infra/db/LocalDb';
import { MobileShell } from '../src/ui/MobileShell';
import { CadastroRural } from '../src/ui/CadastroRural';

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
const plot = {
  id_talhao: 5,
  id_propriedade: 3,
  nome_talhao: 'Norte',
  codigo_talhao: 'N1',
  area_total: 10,
  area_utilizavel: 5,
  latitude: 0,
  longitude: null,
  id_tipo_solo: 99,
  status_inicial: 'Legado',
  topografia: 'Legada',
  observacoes: 'Anterior',
  propriedade_nome: 'Fazenda',
};

function clientFor(put: () => unknown = () => ({ id_talhao: 5 }), company = 7) {
  const request = jest.fn(async (path: string, method?: string) => {
    if (method === 'PUT') return put();
    if (path === '/talhoes/5') return plot;
    if (path === '/propriedades/3') return { ...property, id_empresa: company };
    if (path === '/propriedades') return [property];
    if (path === '/talhoes') return [plot];
    return [];
  });
  return { request, verifySession: jest.fn().mockResolvedValue(undefined) };
}

test('preserva campos não alterados, zero, opção indisponível e limpeza de opcionais', () => {
  const initial = plotFields(plot);
  const result = buildPlotUpdate(
    {
      ...initial,
      nome_talhao: 'Novo',
      area_utilizavel: '0',
      observacoes: '',
      latitude: '',
    },
    initial,
    7,
    property,
  );
  expect(result.errors).toEqual({});
  expect(result.payload).toEqual({
    nome_talhao: 'Novo',
    area_utilizavel: 0,
    observacoes: null,
    latitude: null,
  });
  expect(
    buildPlotUpdate({ ...initial, id_propriedade: '4' }, initial, 7, property)
      .errors.id_propriedade,
  ).toBeTruthy();
  expect(
    buildPlotUpdate({ ...initial, area_utilizavel: '11' }, initial, 7, property)
      .errors.area_utilizavel,
  ).toBeTruthy();
});

test('confere empresa, sessão e associação antes da leitura e do PUT', async () => {
  const wrongCompany = clientFor(undefined, 8);
  await expect(
    loadPlot(wrongCompany as unknown as BackendClient, user, 5),
  ).rejects.toThrow();
  const rejected = await updatePlot(
    wrongCompany as unknown as BackendClient,
    user,
    'online',
    5,
    3,
    { nome_talhao: 'Novo' },
  );
  expect(rejected.status).toBe('rejected');
  expect(
    wrongCompany.request.mock.calls.filter(call => call[1] === 'PUT'),
  ).toHaveLength(0);
  const client = clientFor();
  expect(
    (
      await updatePlot(
        client as unknown as BackendClient,
        user,
        'online',
        5,
        4,
        { nome_talhao: 'Novo' },
      )
    ).status,
  ).toBe('rejected');
  expect(
    (
      await updatePlot(
        client as unknown as BackendClient,
        user,
        'offline',
        5,
        3,
        { nome_talhao: 'Novo' },
      )
    ).status,
  ).toBe('rejected');
  expect(
    client.request.mock.calls.filter(call => call[1] === 'PUT'),
  ).toHaveLength(0);
});

test('classifica sucesso, recusa e resposta incerta sem repetir o PUT', async () => {
  for (const [result, expected] of [
    [() => ({ id_talhao: 5 }), 'saved'],
    [
      () => {
        throw new BackendError(400);
      },
      'rejected',
    ],
    [
      () => {
        throw new Error('rede');
      },
      'uncertain',
    ],
    [() => ({}), 'uncertain'],
  ] as const) {
    const client = clientFor(result);
    expect(
      (
        await updatePlot(
          client as unknown as BackendClient,
          user,
          'online',
          5,
          3,
          { nome_talhao: 'Novo' },
        )
      ).status,
    ).toBe(expected);
    expect(
      client.request.mock.calls.filter(call => call[1] === 'PUT'),
    ).toHaveLength(1);
  }
});

test('timeout após envio é incerto e não repete o PUT', async () => {
  jest.useFakeTimers();
  const client = clientFor(() => new Promise(() => {}));
  const result = updatePlot(
    client as unknown as BackendClient,
    user,
    'online',
    5,
    3,
    { nome_talhao: 'Novo' },
    10,
  );
  await jest.advanceTimersByTimeAsync(10);
  expect((await result).status).toBe('uncertain');
  expect(
    client.request.mock.calls.filter(call => call[1] === 'PUT'),
  ).toHaveLength(1);
  jest.useRealTimers();
});

test('atalho abre lista, carrega talhão atual e confirma descarte', async () => {
  const query = jest.fn(async (sql: string) =>
    sql.includes('COUNT(CASE') ? [{ pending: 0, syncing: 0, errors: 0 }] : [],
  );
  const db = {
    query,
    transaction: async (work: (tx: object) => Promise<unknown>) =>
      work({ query }),
  } as unknown as LocalDb;
  const client = clientFor();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={db}
        client={client as unknown as BackendClient}
        user={user}
        connectivity="online"
        onLogout={jest.fn()}
      />,
    );
  });
  const card = renderer!.root.findByProps({
    accessibilityLabel: 'Abrir lista de talhões',
  });
  expect(card.props.accessibilityValue.text).toBe('1 talhão cadastrado');
  await ReactTestRenderer.act(async () => card.props.onPress());
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Editar talhão Norte' })
      .props.onPress(),
  );
  const form = renderer!.root
    .findAllByType(CadastroRural)
    .find(item => item.props.edit?.property);
  expect(
    form!.findByProps({ accessibilityLabel: 'Nome do talhão *' }).props.value,
  ).toBe('Norte');
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Seleção atual: código ',
  );
  await ReactTestRenderer.act(async () =>
    form!
      .findByProps({ accessibilityLabel: 'Nome do talhão *' })
      .props.onChangeText('Novo'),
  );
  await ReactTestRenderer.act(async () =>
    form!
      .findByProps({ accessibilityLabel: 'Voltar para lista' })
      .props.onPress(),
  );
  expect(alert).toHaveBeenCalledWith(
    'Descartar alterações?',
    expect.any(String),
    expect.any(Array),
  );
  await ReactTestRenderer.act(async () =>
    form!.findByProps({ accessibilityLabel: 'Salvar talhão' }).props.onPress(),
  );
  expect(client.request).toHaveBeenCalledWith('/talhoes/5', 'PUT', {
    nome_talhao: 'Novo',
  });
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Talhão atualizado com sucesso.',
  );
  alert.mockRestore();
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('resultado incerto mantém dados e bloqueia novo envio', async () => {
  const query = jest.fn(async (sql: string) =>
    sql.includes('COUNT(CASE') ? [{ pending: 0, syncing: 0, errors: 0 }] : [],
  );
  const db = {
    query,
    transaction: async (work: (tx: object) => Promise<unknown>) =>
      work({ query }),
  } as unknown as LocalDb;
  const client = clientFor(() => {
    throw new Error('rede');
  });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={db}
        client={client as unknown as BackendClient}
        user={user}
        connectivity="online"
        onLogout={jest.fn()}
      />,
    );
  });
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Abrir lista de talhões' })
      .props.onPress(),
  );
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Editar talhão Norte' })
      .props.onPress(),
  );
  const form = renderer!.root
    .findAllByType(CadastroRural)
    .find(item => item.props.edit?.property)!;
  await ReactTestRenderer.act(async () =>
    form
      .findByProps({ accessibilityLabel: 'Nome do talhão *' })
      .props.onChangeText('Novo'),
  );
  await ReactTestRenderer.act(async () =>
    form.findByProps({ accessibilityLabel: 'Salvar talhão' }).props.onPress(),
  );
  expect(
    form.findByProps({ accessibilityLabel: 'Nome do talhão *' }).props.value,
  ).toBe('Novo');
  expect(
    form.findByProps({ accessibilityLabel: 'Salvar talhão' }).props.disabled,
  ).toBe(true);
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Não foi possível confirmar o salvamento',
  );
  await ReactTestRenderer.act(async () =>
    form
      .findByProps({ accessibilityLabel: 'Voltar para lista' })
      .props.onPress(),
  );
  expect(alert).toHaveBeenCalledWith(
    'Descartar alterações?',
    expect.stringContaining('resultado não foi confirmado'),
    expect.any(Array),
  );
  expect(
    client.request.mock.calls.filter(call => call[1] === 'PUT'),
  ).toHaveLength(1);
  alert.mockRestore();
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('salvamento confirmado com falha de recarga oferece apenas nova leitura', async () => {
  const query = jest.fn(async (sql: string) =>
    sql.includes('COUNT(CASE') ? [{ pending: 0, syncing: 0, errors: 0 }] : [],
  );
  const db = {
    query,
    transaction: async (work: (tx: object) => Promise<unknown>) =>
      work({ query }),
  } as unknown as LocalDb;
  let failRefresh = false;
  const client = clientFor(() => {
    failRefresh = true;
    return { id_talhao: 5 };
  });
  const baseRequest = client.request.getMockImplementation()!;
  client.request.mockImplementation(async (path, method) => {
    if (failRefresh && path === '/talhoes' && !method) throw new Error('rede');
    return baseRequest(path, method);
  });
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={db}
        client={client as unknown as BackendClient}
        user={user}
        connectivity="online"
        onLogout={jest.fn()}
      />,
    );
  });
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Abrir lista de talhões' })
      .props.onPress(),
  );
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Editar talhão Norte' })
      .props.onPress(),
  );
  const form = renderer!.root
    .findAllByType(CadastroRural)
    .find(item => item.props.edit?.property)!;
  await ReactTestRenderer.act(async () =>
    form
      .findByProps({ accessibilityLabel: 'Nome do talhão *' })
      .props.onChangeText('Novo'),
  );
  await ReactTestRenderer.act(async () =>
    form.findByProps({ accessibilityLabel: 'Salvar talhão' }).props.onPress(),
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Talhão atualizado com sucesso, mas a lista não foi atualizada.',
  );
  failRefresh = false;
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Atualizar lista de talhões' })
      .props.onPress(),
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Lista de talhões atualizada.',
  );
  expect(
    client.request.mock.calls.filter(call => call[1] === 'PUT'),
  ).toHaveLength(1);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});
