import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { MobileShell } from '../src/ui/MobileShell';
import { CadastroRural } from '../src/ui/CadastroRural';
import type { BackendClient, Usuario } from '../src/infra/api/BackendClient';
import type { LocalDb } from '../src/infra/db/LocalDb';

const user: Usuario = {
  id: 1,
  nome: 'Karla',
  perfil: 'administrador',
  id_empresa: 7,
};

function pressByText(
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
) {
  renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
}

test.each([
  {
    description: 'com propriedades',
    connectivity: 'online' as const,
    properties: [
      { id_propriedade: 3, id_empresa: 7, nome_propriedade: 'Fazenda' },
    ],
    count: '1 propriedade cadastrada',
    expected: 'Fazenda',
  },
  {
    description: 'com lista vazia',
    connectivity: 'online' as const,
    properties: [],
    count: '0 propriedades cadastradas',
    expected: 'Nenhuma propriedade disponível para esta empresa.',
  },
  {
    description: 'com dados indisponíveis',
    connectivity: 'offline' as const,
    properties: [],
    count: 'Quantidade de propriedades indisponível',
    expected: 'Propriedades do servidor indisponíveis.',
  },
])(
  'atalho inicial abre a lista $description',
  async ({ connectivity, properties, count, expected }) => {
    const query = jest.fn(async (sql: string) =>
      sql.includes('COUNT(CASE') ? [{ pending: 0, syncing: 0, errors: 0 }] : [],
    );
    const db = {
      query,
      transaction: async (work: (tx: object) => Promise<unknown>) =>
        work({ query }),
    } as unknown as LocalDb;
    const request = jest.fn(async (path: string) =>
      path === '/propriedades' ? properties : [],
    );
    const client = {
      request,
      verifySession: jest.fn().mockResolvedValue(undefined),
    } as unknown as BackendClient;
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <MobileShell
          db={db}
          client={client}
          user={{ ...user, perfil: 'operador' }}
          connectivity={connectivity}
          onLogout={jest.fn()}
        />,
      );
    });
    const card = renderer!.root.findByProps({
      accessibilityLabel: 'Abrir lista de propriedades',
    });
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityValue.text).toBe(count);
    const previousRequests = request.mock.calls.length;
    await ReactTestRenderer.act(async () => card.props.onPress());
    expect(JSON.stringify(renderer!.toJSON())).toContain(expected);
    expect(request).toHaveBeenCalledTimes(previousRequests);
    expect(
      renderer!.root.findByProps({ accessibilityLabel: '+ Nova propriedade' }),
    ).toBeTruthy();
    await ReactTestRenderer.act(async () => renderer!.unmount());
  },
);

test('abre o cartão de propriedade, permite nova tentativa e carrega dados atuais', async () => {
  const query = jest.fn(async (sql: string) =>
    sql.includes('COUNT(CASE') ? [{ pending: 0, syncing: 0, errors: 0 }] : [],
  );
  const db = {
    query,
    transaction: async (work: (tx: object) => Promise<unknown>) =>
      work({ query }),
  } as unknown as LocalDb;
  let attempts = 0;
  const request = jest.fn(async (path: string) => {
    if (path === '/propriedades')
      return [
        { id_propriedade: 3, id_empresa: 7, nome_propriedade: 'Fazenda' },
      ];
    if (path === '/propriedades/3') {
      attempts += 1;
      if (attempts === 1) throw new Error('404');
      return {
        id_propriedade: 3,
        id_empresa: 7,
        nome_propriedade: 'Dados atuais',
        car: 'CAR',
        latitude: 0,
        longitude: 0,
        area_total: 1,
        area_agricultavel: 0,
        area_preservacao: 0,
      };
    }
    if (path.startsWith('/financeiro/'))
      return { receita_total: 0, despesa_total: 0, saldo: 0 };
    return [];
  });
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={db}
        client={client}
        user={user}
        connectivity="online"
        onLogout={jest.fn()}
      />,
    );
  });
  await ReactTestRenderer.act(async () => {
    pressByText(renderer!, 'Mais');
  });
  await ReactTestRenderer.act(async () => {
    pressByText(renderer!, 'Propriedades');
  });
  await ReactTestRenderer.act(async () => {
    pressByText(renderer!, 'Editar propriedade Fazenda');
  });
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Não foi possível carregar a propriedade',
  );
  await ReactTestRenderer.act(async () => {
    pressByText(renderer!, 'Tentar carregar novamente');
  });
  expect(
    renderer!.root
      .findAllByProps({ accessibilityLabel: 'Nome da propriedade *' })
      .some(input => input.props.value === 'Dados atuais'),
  ).toBe(true);
  expect(attempts).toBe(2);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('navega pela lista e salva atividade local com o payload do backend', async () => {
  const execute = jest.fn().mockResolvedValue({ rowsAffected: 1 });
  let nextId = 0;
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('COUNT(CASE')) {
      return [{ pending: 0, syncing: 0, errors: 0 }];
    }
    if (sql.includes('randomblob')) {
      nextId += 1;
      return [{ id: `id-${nextId}` }];
    }
    return [];
  });
  const db = {
    query,
    transaction: async (work: (tx: object) => Promise<unknown>) =>
      work({ query, execute }),
  } as unknown as LocalDb;
  const request = jest.fn(async (path: string) => {
    const data: Record<string, unknown> = {
      '/propriedades': [
        { id_propriedade: 3, id_empresa: 7, nome_propriedade: 'Fazenda' },
      ],
      '/talhoes': [
        {
          id_talhao: 5,
          id_propriedade: 3,
          nome_talhao: 'Talhão A',
          codigo_talhao: 'A',
        },
      ],
      '/atividades': [
        {
          id_atividade_agricola: 9,
          id_empresa: 7,
          id_propriedade: 3,
          tipo_atividade: 'Colheita',
          nome_talhao: 'Talhão A',
          status: 'Planejada',
          data_inicio: '2026-11-22',
        },
      ],
      '/categorias-atividade': [
        { id_categoria_atividade: 1, nome: 'Plantio', status: true },
      ],
      '/tipos-atividade': [
        {
          id_atividade: 2,
          id_categoria_atividade: 1,
          descricao: 'Semeadura',
          status: true,
        },
      ],
      '/safras': [],
      '/financeiro/saldo?id_propriedade=3': {
        receita_total: 0,
        despesa_total: 0,
        saldo: 0,
      },
      '/lancamentos?id_propriedade=3': [],
      '/funcionarios?id_propriedade=3&status=ativo': [],
    };
    return data[path];
  });
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={db}
        client={client}
        user={user}
        connectivity="online"
        onLogout={jest.fn()}
      />,
    );
  });
  await ReactTestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Atividades' })
      .props.onPress();
  });
  expect(JSON.stringify(renderer!.toJSON())).toContain('Colheita');
  await ReactTestRenderer.act(async () => {
    pressByText(renderer!, '+ Nova atividade');
  });
  await ReactTestRenderer.act(async () => {
    pressByText(renderer!, 'Plantio');
  });
  await ReactTestRenderer.act(async () => {
    pressByText(renderer!, 'Semeadura');
  });
  await ReactTestRenderer.act(async () => {
    pressByText(renderer!, 'A · Talhão A');
  });
  await ReactTestRenderer.act(async () => {
    pressByText(renderer!, 'Salvar atividade');
  });
  const insert = execute.mock.calls.find(call =>
    call[0].includes('INSERT INTO sync_queue'),
  );
  expect(insert).toBeDefined();
  expect(JSON.parse(insert![1][4])).toMatchObject({
    id_categoria_atividade: 1,
    id_tipo_atividade: 2,
    id_talhao: 5,
    id_propriedade: 3,
    id_empresa: 7,
    status: 'Planejada',
  });
  await ReactTestRenderer.act(async () => {
    renderer!.unmount();
  });
});

test('não consulta o servidor quando está offline', async () => {
  const db = {
    query: jest.fn(async (sql: string) =>
      sql.includes('COUNT(CASE') ? [{ pending: 0, syncing: 0, errors: 0 }] : [],
    ),
  } as unknown as LocalDb;
  const client = {
    request: jest.fn(),
    verifySession: jest.fn(),
  } as unknown as BackendClient;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={db}
        client={client}
        user={user}
        connectivity="offline"
        onLogout={jest.fn()}
      />,
    );
  });
  expect(client.request).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer!.toJSON())).toContain('Offline · modo campo');
  await ReactTestRenderer.act(async () => {
    renderer!.unmount();
  });
});

test('navega das listas para os cadastros de propriedade e talhão', async () => {
  const db = {
    query: jest.fn(async (sql: string) =>
      sql.includes('COUNT(CASE') ? [{ pending: 0, syncing: 0, errors: 0 }] : [],
    ),
  } as unknown as LocalDb;
  const client = {
    request: jest.fn(async () => []),
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={db}
        client={client}
        user={user}
        connectivity="online"
        onLogout={jest.fn()}
      />,
    );
  });
  await ReactTestRenderer.act(async () => {
    pressByText(renderer!, 'Mais');
  });
  await ReactTestRenderer.act(async () => {
    pressByText(renderer!, 'Propriedades');
  });
  await ReactTestRenderer.act(async () => {
    pressByText(renderer!, '+ Nova propriedade');
  });
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Salvar propriedade' }),
  ).toBeDefined();
  await ReactTestRenderer.act(async () => {
    pressByText(renderer!, 'Mais');
  });
  await ReactTestRenderer.act(async () => {
    pressByText(renderer!, 'Talhões');
  });
  await ReactTestRenderer.act(async () => {
    pressByText(renderer!, '+ Novo talhão');
  });
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Salvar talhão' }),
  ).toBeDefined();
  await ReactTestRenderer.act(async () => {
    renderer!.unmount();
  });
});

test('atualiza lista e seletor de atividades após cadastrar talhão', async () => {
  const query = jest.fn(async (sql: string) =>
    sql.includes('COUNT(CASE') ? [{ pending: 0, syncing: 0, errors: 0 }] : [],
  );
  const db = {
    query,
    transaction: async (work: (tx: object) => Promise<unknown>) =>
      work({ query, execute: jest.fn() }),
  } as unknown as LocalDb;
  const plots: object[] = [];
  const request = jest.fn(async (path: string, method?: string) => {
    if (path === '/talhoes' && method === 'POST') {
      plots.push({
        id_talhao: 5,
        id_propriedade: 3,
        nome_talhao: 'Novo',
        codigo_talhao: 'N1',
        area_total: 10,
      });
      return { id_talhao: 5 };
    }
    if (path === '/propriedades') {
      return [
        { id_propriedade: 3, id_empresa: 7, nome_propriedade: 'Fazenda' },
      ];
    }
    if (path === '/talhoes') return plots;
    if (path.startsWith('/financeiro/saldo'))
      return { receita_total: 0, despesa_total: 0, saldo: 0 };
    return [];
  });
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MobileShell
        db={db}
        client={client}
        user={user}
        connectivity="online"
        onLogout={jest.fn()}
      />,
    );
  });
  await ReactTestRenderer.act(async () => pressByText(renderer!, 'Mais'));
  await ReactTestRenderer.act(async () => pressByText(renderer!, 'Talhões'));
  await ReactTestRenderer.act(async () =>
    pressByText(renderer!, '+ Novo talhão'),
  );
  await ReactTestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Nome do talhão *' })
      .props.onChangeText('Novo');
    renderer!.root
      .findByProps({ accessibilityLabel: 'Código do talhão *' })
      .props.onChangeText('N1');
    renderer!.root
      .findAllByType(CadastroRural)[1]
      .findByProps({ accessibilityLabel: 'Área total (ha) *' })
      .props.onChangeText('10');
    pressByText(renderer!, 'Fazenda');
  });
  await ReactTestRenderer.act(async () =>
    pressByText(renderer!, 'Salvar talhão'),
  );
  expect(request.mock.calls.filter(call => call[1] === 'POST')).toHaveLength(1);
  await ReactTestRenderer.act(async () => {
    renderer!.root
      .findAllByType(CadastroRural)[1]
      .findByProps({ accessibilityLabel: 'Voltar para lista' })
      .props.onPress();
  });
  expect(renderer!.root.findByProps({ children: 'Novo' })).toBeDefined();
  await ReactTestRenderer.act(async () => pressByText(renderer!, 'Atividades'));
  await ReactTestRenderer.act(async () =>
    pressByText(renderer!, '+ Nova atividade'),
  );
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'N1 · Novo' }),
  ).toBeDefined();
  await ReactTestRenderer.act(async () => renderer!.unmount());
});
