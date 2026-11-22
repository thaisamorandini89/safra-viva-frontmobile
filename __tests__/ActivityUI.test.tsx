import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { MobileShell } from '../src/ui/MobileShell';
import type { BackendClient, Usuario } from '../src/infra/api/BackendClient';
import type { LocalDb } from '../src/infra/db/LocalDb';

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
  codigo_talhao: 'N',
};
const activity = {
  id_atividade_agricola: 9,
  id_empresa: null,
  id_propriedade: 3,
  id_talhao: 5,
  id_tipo_atividade: 2,
  tipo_atividade: 'Plantio',
  nome_propriedade: 'Fazenda',
  nome_talhao: 'Norte',
  status: 'Planejada',
  data_inicio: '2026-11-22',
  safra: null,
  custo_total: 0,
  insumos: [{ nome: 'Semente', quantidade: 0, unidade: 'kg' }],
};
const local = {
  local_id: 'local-1',
  server_id: '42',
  sync_status: 'synced',
  data_json: JSON.stringify({
    tipo_atividade: 'Colheita',
    nome_talhao: 'Norte',
    data_inicio: '2026-11-23',
  }),
  created_at: '',
  updated_at: '',
  device_id: 'local',
  last_error: null,
};

function setup() {
  let failList = false;
  let conflictDetail = false;
  let serverHasLocal = false;
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('COUNT(CASE'))
      return [{ pending: 0, syncing: 0, errors: 0 }];
    if (sql.includes('FROM atividade_agricola_local')) return [local];
    return [];
  });
  const db = {
    query,
    transaction: async (work: (tx: object) => Promise<unknown>) =>
      work({ query }),
  } as unknown as LocalDb;
  const request = jest.fn(async (path: string, method?: string) => {
    if (method) throw new Error('Teste não deve enviar alterações');
    if (path === '/propriedades') return [property];
    if (path === '/talhoes') return [plot];
    if (path === '/atividades') {
      if (failList) throw new Error('offline');
      return serverHasLocal
        ? [
            activity,
            {
              ...activity,
              id_atividade_agricola: 42,
              tipo_atividade: 'Colheita',
            },
          ]
        : [activity];
    }
    if (path === '/atividades/9')
      return conflictDetail ? { ...activity, id_empresa: 8 } : activity;
    if (path === '/categorias-atividade')
      throw new Error('catálogo indisponível');
    return [];
  });
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  return {
    db,
    client,
    request,
    query,
    setFailList: (value: boolean) => {
      failList = value;
    },
    setConflictDetail: (value: boolean) => {
      conflictDetail = value;
    },
    setServerHasLocal: (value: boolean) => {
      serverHasLocal = value;
    },
  };
}

test('lista dados web apesar de falha de catálogo, pesquisa e abre detalhe sem mutação', async () => {
  const env = setup();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={env.db}
        client={env.client}
        user={user}
        connectivity="online"
        onLogout={jest.fn()}
      />,
    );
  });
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Atividades' })
      .props.onPress(),
  );
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: 'Consultar atividade Plantio',
    }),
  ).toBeDefined();
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: 'Consultar atividade local Colheita',
    }),
  ).toBeDefined();
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Buscar atividades' })
      .props.onChangeText('plantio'),
  );
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: 'Consultar atividade local Colheita',
    }),
  ).toHaveLength(0);
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Consultar atividade Plantio' })
      .props.onPress(),
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain('Semente');
  expect(env.request).toHaveBeenCalledWith('/atividades/9');
  expect(env.request.mock.calls.filter(call => call[1])).toHaveLength(0);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('erro inicial não aparece como lista vazia e cadastro sem apoio não cria evento', async () => {
  const env = setup();
  env.setFailList(true);
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={env.db}
        client={env.client}
        user={user}
        connectivity="online"
        onLogout={jest.fn()}
      />,
    );
  });
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Atividades' })
      .props.onPress(),
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Não foi possível atualizar as atividades',
  );
  expect(JSON.stringify(renderer!.toJSON())).not.toContain(
    'Nenhuma atividade encontrada.',
  );
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: '+ Nova atividade' })
      .props.onPress(),
  );
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Salvar atividade' })
      .props.onPress(),
  );
  expect(
    env.query.mock.calls.some(call => call[0].includes('randomblob')),
  ).toBe(false);
  expect(env.request.mock.calls.filter(call => call[1])).toHaveLength(0);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('atividade local abre no modo offline com indicação do estado da fila', async () => {
  const env = setup();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={env.db}
        client={env.client}
        user={user}
        connectivity="offline"
        onLogout={jest.fn()}
      />,
    );
  });
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Atividades' })
      .props.onPress(),
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Atividades do servidor indisponíveis',
  );
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Consultar atividade local Colheita' })
      .props.onPress(),
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Enviada — aguardando atualização da lista',
  );
  expect(env.request).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('falha de recarga mantém registro confirmado e nova leitura concilia por ID sem POST', async () => {
  const env = setup();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={env.db}
        client={env.client}
        user={user}
        connectivity="online"
        onLogout={jest.fn()}
      />,
    );
  });
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Atividades' })
      .props.onPress(),
  );
  env.setFailList(true);
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: '↻ Atualizar atividades' })
      .props.onPress(),
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'podem estar desatualizados',
  );
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: 'Consultar atividade local Colheita',
    }),
  ).toBeDefined();
  env.setFailList(false);
  env.setServerHasLocal(true);
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: '↻ Atualizar atividades' })
      .props.onPress(),
  );
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: 'Consultar atividade local Colheita',
    }),
  ).toHaveLength(0);
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: 'Consultar atividade Colheita',
    }),
  ).toBeDefined();
  expect(env.request.mock.calls.filter(call => call[1])).toHaveLength(0);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('detalhe remoto recusa vínculo que mudou após a listagem', async () => {
  const env = setup();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={env.db}
        client={env.client}
        user={user}
        connectivity="online"
        onLogout={jest.fn()}
      />,
    );
  });
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Atividades' })
      .props.onPress(),
  );
  env.setConflictDetail(true);
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Consultar atividade Plantio' })
      .props.onPress(),
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Não foi possível carregar a atividade ou confirmar seus vínculos.',
  );
  expect(JSON.stringify(renderer!.toJSON())).not.toContain('Semente');
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('prévia não herda pesquisa e atalho abre lista completa', async () => {
  const env = setup();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={env.db}
        client={env.client}
        user={user}
        connectivity="online"
        onLogout={jest.fn()}
      />,
    );
  });
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Atividades' })
      .props.onPress(),
  );
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Buscar atividades' })
      .props.onChangeText('não existe'),
  );
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Início' })
      .props.onPress(),
  );
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: 'Consultar atividade Plantio',
    }),
  ).toBeDefined();
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Abrir lista de atividades' })
      .props.onPress(),
  );
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Buscar atividades' })
      .props.value,
  ).toBe('');
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: 'Consultar atividade Plantio',
    }),
  ).toBeDefined();
  expect(env.request.mock.calls.filter(call => call[1])).toHaveLength(0);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test.each([
  'Abrir atividades pela página inicial',
  'Atividades, atalho rápido',
])('%s abre a listagem completa e limpa busca anterior', async label => {
  const env = setup();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={env.db}
        client={env.client}
        user={user}
        connectivity="online"
        onLogout={jest.fn()}
      />,
    );
  });
  const card = renderer!.root.findByProps({
    accessibilityLabel: 'Abrir atividades pela página inicial',
  });
  expect(card.props.accessibilityValue.text).toBe('1 atividade do servidor');
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Atividades' })
      .props.onPress(),
  );
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Buscar atividades' })
      .props.onChangeText('não existe'),
  );
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Voltar ao início' })
      .props.onPress(),
  );
  const button = renderer!.root.findByProps({ accessibilityLabel: label });
  expect(button.props.accessibilityRole).toBe('button');
  await ReactTestRenderer.act(async () => button.props.onPress());
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Buscar atividades' })
      .props.value,
  ).toBe('');
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: 'Consultar atividade Plantio',
    }),
  ).toBeDefined();
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: 'Consultar atividade local Colheita',
    }),
  ).toBeDefined();
  expect(env.request.mock.calls.filter(call => call[1])).toHaveLength(0);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('cartão de atividades indica indisponibilidade e dados desatualizados offline', async () => {
  const env = setup();
  const shell = (connectivity: 'online' | 'offline') => (
    <MobileShell
      db={env.db}
      client={env.client}
      user={user}
      connectivity={connectivity}
      onLogout={jest.fn()}
    />
  );
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(shell('offline'));
  });
  const metric = () =>
    renderer!.root.findByProps({
      accessibilityLabel: 'Abrir atividades pela página inicial',
    });
  expect(metric().props.accessibilityValue.text).toBe(
    'Quantidade de atividades do servidor indisponível',
  );
  await ReactTestRenderer.act(async () => metric().props.onPress());
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Atividades do servidor indisponíveis',
  );
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: 'Consultar atividade local Colheita',
    }),
  ).toBeDefined();
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Voltar ao início' })
      .props.onPress(),
  );
  await ReactTestRenderer.act(async () => renderer!.update(shell('online')));
  await ReactTestRenderer.act(async () => renderer!.update(shell('offline')));
  expect(metric().props.accessibilityValue.text).toBe(
    '1 atividade do servidor, dados possivelmente desatualizados',
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'do servidor · podem estar desatualizadas',
  );
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test.each([
  ['Nova atividade', 'Salvar atividade'],
  ['Talhões', '+ Novo talhão'],
  ['Financeiro', 'Seu perfil não tem acesso aos dados financeiros.'],
  ['Abrir sincronização', 'Sincronizar agora'],
])('atalho %s abre destino correto', async (shortcut, expected) => {
  const env = setup();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={env.db}
        client={env.client}
        user={user}
        connectivity="offline"
        onLogout={jest.fn()}
      />,
    );
  });
  const button = renderer!.root.findByProps({ accessibilityLabel: shortcut });
  expect(button.props.accessibilityRole).toBe('button');
  await ReactTestRenderer.act(async () => button.props.onPress());
  expect(JSON.stringify(renderer!.toJSON())).toContain(expected);
  expect(env.request).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('atalho de insumos informa indisponibilidade sem navegar nem consultar backend', async () => {
  const env = setup();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={env.db}
        client={env.client}
        user={user}
        connectivity="offline"
        onLogout={jest.fn()}
      />,
    );
  });
  const button = renderer!.root.findByProps({
    accessibilityLabel: 'Insumos, indisponível',
  });
  expect(button.props.accessibilityRole).toBe('button');
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Atalhos rápidos' }).props
      .horizontal,
  ).toBe(true);
  await ReactTestRenderer.act(async () => button.props.onPress());
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'A consulta de insumos ainda não está disponível',
  );
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: 'Abrir lista de atividades',
    }),
  ).toBeDefined();
  expect(env.request).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('início mostra falha ou indisponibilidade sem apresentar lista vazia', async () => {
  const env = setup();
  env.setFailList(true);
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={env.db}
        client={env.client}
        user={user}
        connectivity="online"
        onLogout={jest.fn()}
      />,
    );
  });
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Não foi possível atualizar as atividades',
  );
  expect(JSON.stringify(renderer!.toJSON())).not.toContain(
    'Nenhuma atividade do servidor encontrada.',
  );
  await ReactTestRenderer.act(async () =>
    renderer!.update(
      <MobileShell
        db={env.db}
        client={env.client}
        user={user}
        connectivity="offline"
        onLogout={jest.fn()}
      />,
    ),
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Atividades do servidor indisponíveis',
  );
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: 'Abrir lista de atividades',
    }),
  ).toBeDefined();
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('prévia mostra estado vazio sem perder acesso à lista', async () => {
  const env = setup();
  const originalRequest = env.request.getMockImplementation()!;
  env.request.mockImplementation(async (path: string, method?: string) =>
    path === '/atividades' ? [] : originalRequest(path, method),
  );
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={env.db}
        client={env.client}
        user={user}
        connectivity="online"
        onLogout={jest.fn()}
      />,
    );
  });
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Nenhuma atividade do servidor encontrada.',
  );
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: 'Abrir atividades pela página inicial',
    }).props.accessibilityValue.text,
  ).toBe('0 atividades do servidor');
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: 'Abrir lista de atividades',
    }),
  ).toBeDefined();
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('perda de conexão interrompe o indicador de carregamento remoto', async () => {
  const env = setup();
  const originalRequest = env.request.getMockImplementation()!;
  env.request.mockImplementation(async (path: string, method?: string) =>
    path === '/atividades'
      ? new Promise(() => {})
      : originalRequest(path, method),
  );
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={env.db}
        client={env.client}
        user={user}
        connectivity="online"
        onLogout={jest.fn()}
      />,
    );
  });
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Carregando atividades...',
  );
  await ReactTestRenderer.act(async () =>
    renderer!.update(
      <MobileShell
        db={env.db}
        client={env.client}
        user={user}
        connectivity="offline"
        onLogout={jest.fn()}
      />,
    ),
  );
  expect(JSON.stringify(renderer!.toJSON())).not.toContain(
    'Carregando atividades...',
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Atividades do servidor indisponíveis',
  );
  await ReactTestRenderer.act(async () => renderer!.unmount());
});
