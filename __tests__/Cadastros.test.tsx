import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { validateCadastro, parseNumber } from '../src/app/cadastros/validation';
import { createCadastro } from '../src/app/cadastros/createCadastro';
import {
  BackendError,
  type BackendClient,
  type Usuario,
} from '../src/infra/api/BackendClient';
import { CadastroRural } from '../src/ui/CadastroRural';

const user: Usuario = {
  id: 1,
  nome: 'Pessoa',
  perfil: 'administrador',
  id_empresa: 7,
};
const properties = [
  { id_propriedade: 3, id_empresa: 7, nome_propriedade: 'Minha propriedade' },
  { id_propriedade: 4, id_empresa: 8, nome_propriedade: 'Outra propriedade' },
];
const propertyFields = {
  nome_propriedade: ' Fazenda ',
  car: 'CAR-123',
  latitude: '-15,5',
  longitude: '-47,2',
  area_total: '1.500,50',
  area_agricultavel: '1000',
  area_preservacao: '0',
};

test('normaliza números e monta propriedade conforme o contrato', () => {
  expect(parseNumber('1.500,50')).toBe(1500.5);
  expect(parseNumber('1abc')).toBeNaN();
  const result = validateCadastro(
    'propriedade',
    { ...propertyFields, id_tipo_solo: '2' },
    7,
    properties,
  );
  expect(result.errors).toEqual({});
  expect(result.payload).toMatchObject({
    nome_propriedade: 'Fazenda',
    id_empresa: 7,
    latitude: -15.5,
    area_total: 1500.5,
    id_tipo_solo: 2,
  });
});

test('valida empresa, áreas, coordenadas e endereço parcial', () => {
  const result = validateCadastro(
    'propriedade',
    {
      ...propertyFields,
      latitude: '-91',
      area_total: '0',
      area_preservacao: '-1',
      bairro: 'Rural',
    },
    null,
    properties,
  );
  expect(result.errors).toMatchObject({
    empresa: expect.any(String),
    latitude: expect.any(String),
    area_total: expect.any(String),
    area_preservacao: expect.any(String),
    cep: expect.any(String),
    id_cidade: expect.any(String),
    logradouro: expect.any(String),
  });
  const complete = validateCadastro(
    'propriedade',
    {
      ...propertyFields,
      cep: '70000-000',
      id_cidade: '3',
      logradouro: 'Estrada',
      bairro: 'Rural',
    },
    7,
    properties,
  );
  expect(complete.errors).toEqual({});
  expect(complete.payload).toMatchObject({
    cep: '70000000',
    id_cidade: 3,
    logradouro: 'Estrada',
  });
});

test('valida a propriedade do talhão e os nomes esperados pela API', () => {
  const fields = {
    nome_talhao: 'A',
    codigo_talhao: '01',
    id_propriedade: '3',
    area_total: '10',
    area_utilizavel: '11',
    id_tipo_solo: '2',
  };
  expect(
    validateCadastro('talhao', fields, 7, properties).errors.area_utilizavel,
  ).toBeTruthy();
  const valid = validateCadastro(
    'talhao',
    { ...fields, area_utilizavel: '' },
    7,
    properties,
  );
  expect(valid.errors).toEqual({});
  expect(valid.payload).toEqual({
    nome_talhao: 'A',
    codigo_talhao: '01',
    id_propriedade: 3,
    area_total: 10,
    id_tipo_solo: 2,
  });
  expect(
    validateCadastro(
      'talhao',
      { ...fields, id_propriedade: '4' },
      7,
      properties,
    ).errors.id_propriedade,
  ).toBeTruthy();
});

test('envia somente após verificar sessão, e classifica falhas com segurança', async () => {
  const request = jest.fn().mockResolvedValue({ id_propriedade: 2 });
  const verifySession = jest.fn().mockResolvedValue(undefined);
  const client = { request, verifySession } as unknown as BackendClient;
  const payload = { nome_propriedade: 'A', id_empresa: 7 };
  expect(
    await createCadastro(client, user, 'online', 'propriedade', payload),
  ).toEqual({ status: 'created', id: 2 });
  expect(request).toHaveBeenCalledWith('/propriedades', 'POST', payload);
  request.mockRejectedValueOnce(new BackendError(400));
  expect(
    (await createCadastro(client, user, 'online', 'talhao', payload)).status,
  ).toBe('rejected');
  request.mockRejectedValueOnce(new BackendError(403));
  expect(
    await createCadastro(client, user, 'online', 'talhao', payload),
  ).toMatchObject({
    status: 'rejected',
    message: expect.stringContaining('permissão'),
  });
  request.mockRejectedValueOnce(new BackendError(500));
  expect(
    (await createCadastro(client, user, 'online', 'talhao', payload)).status,
  ).toBe('uncertain');
  request.mockRejectedValueOnce(new BackendError(408));
  expect(
    (await createCadastro(client, user, 'online', 'talhao', payload)).status,
  ).toBe('uncertain');
  request.mockRejectedValueOnce(new Error('rede'));
  expect(
    (await createCadastro(client, user, 'online', 'talhao', payload)).status,
  ).toBe('uncertain');
  verifySession.mockRejectedValueOnce(new Error('empresa alterada'));
  const count = request.mock.calls.length;
  expect(
    (await createCadastro(client, user, 'online', 'talhao', payload)).status,
  ).toBe('rejected');
  expect(
    (await createCadastro(client, user, 'offline', 'talhao', payload)).status,
  ).toBe('rejected');
  expect(request).toHaveBeenCalledTimes(count);
});

test('formulário de talhão sem propriedade orienta cadastro e valida campos', async () => {
  const request = jest.fn(async (_path: string, _method?: string) => []);
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CadastroRural
        kind="talhao"
        visible
        client={client}
        user={user}
        connectivity="online"
        properties={[]}
        refresh={jest.fn()}
        onClose={jest.fn()}
        busy={false}
        onBusyChange={jest.fn()}
      />,
    );
  });
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Cadastre uma propriedade primeiro',
  );
  await ReactTestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Salvar talhão' })
      .props.onPress();
  });
  const screen = JSON.stringify(renderer!.toJSON());
  expect(screen).toContain('Informe o nome do talhão');
  expect(screen).toContain('Selecione uma propriedade da sua empresa');
  expect(request.mock.calls.filter(call => call[1] === 'POST')).toHaveLength(0);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('rejeição preserva o formulário para correção e novo envio', async () => {
  const request = jest.fn(async (_path: string, method?: string) => {
    if (method === 'POST') {
      throw new BackendError(400);
    }
    return [];
  });
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CadastroRural
        kind="talhao"
        visible
        client={client}
        user={user}
        connectivity="online"
        properties={properties}
        refresh={jest.fn()}
        onClose={jest.fn()}
        busy={false}
        onBusyChange={jest.fn()}
      />,
    );
  });
  await ReactTestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Nome do talhão *' })
      .props.onChangeText('Teste');
    renderer!.root
      .findByProps({ accessibilityLabel: 'Código do talhão *' })
      .props.onChangeText('T1');
    renderer!.root
      .findByProps({ accessibilityLabel: 'Área total (ha) *' })
      .props.onChangeText('10');
    renderer!.root
      .findByProps({ accessibilityLabel: 'Minha propriedade' })
      .props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Salvar talhão' })
      .props.onPress();
  });
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Nome do talhão *' }).props
      .value,
  ).toBe('Teste');
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Salvar talhão' }).props
      .disabled,
  ).toBe(false);
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'O servidor recusou os dados',
  );
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('timeout após POST é incerto e não reenvia', async () => {
  jest.useFakeTimers();
  const request = jest.fn(() => new Promise(() => {}));
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  const result = createCadastro(client, user, 'online', 'talhao', {}, 10);
  await Promise.resolve();
  jest.advanceTimersByTime(10);
  expect((await result).status).toBe('uncertain');
  expect(request).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});

test('formulário filtra propriedades e preserva confirmação se atualização falha', async () => {
  const request = jest.fn(async (path: string, method?: string) => {
    if (method === 'POST') {
      return { id_talhao: 12 };
    }
    if (path === '/tipos-solo') {
      return [{ id: 5, descricao: 'Argiloso' }];
    }
    return [];
  });
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CadastroRural
        kind="talhao"
        visible
        client={client}
        user={user}
        connectivity="online"
        properties={properties}
        refresh={jest.fn().mockResolvedValue(false)}
        onClose={jest.fn()}
        busy={false}
        onBusyChange={jest.fn()}
      />,
    );
  });
  expect(JSON.stringify(renderer!.toJSON())).not.toContain('Outra propriedade');
  const input = (label: string, value: string) =>
    renderer!.root
      .findByProps({ accessibilityLabel: label })
      .props.onChangeText(value);
  const press = (label: string) =>
    renderer!.root.findByProps({ accessibilityLabel: label }).props.onPress();
  await ReactTestRenderer.act(async () => {
    input('Nome do talhão *', 'Talhão Novo');
    input('Código do talhão *', 'T-1');
    input('Área total (ha) *', '10');
    press('Minha propriedade');
    press('Argiloso');
  });
  await ReactTestRenderer.act(async () => {
    press('Salvar talhão');
  });
  expect(request).toHaveBeenCalledWith(
    '/talhoes',
    'POST',
    expect.objectContaining({
      id_propriedade: 3,
      id_tipo_solo: 5,
      nome_talhao: 'Talhão Novo',
    }),
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Cadastro realizado com sucesso',
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'lista não foi atualizada',
  );
  expect(request.mock.calls.filter(call => call[1] === 'POST')).toHaveLength(1);
  await ReactTestRenderer.act(async () => {
    renderer!.unmount();
  });
});

test('propriedade usa empresa da sessão, valida campos e envia dados selecionados', async () => {
  const request = jest.fn(async (path: string, method?: string) => {
    if (method === 'POST') {
      return { id_propriedade: 11 };
    }
    const catalogs: Record<string, unknown> = {
      '/tipos-solo': [{ id: 5, descricao: 'Argiloso' }],
      '/classes-uso': [
        { id_classe_capacidade_uso: 9, sigla: 'I', descricao: 'Uso' },
      ],
      '/estados': [{ id: 1, uf: 'SP', nome: 'São Paulo' }],
      '/estados/1/cidades': [{ id: 2, nome: 'Campinas' }],
    };
    return catalogs[path];
  });
  const refresh = jest.fn().mockResolvedValue(true);
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CadastroRural
        kind="propriedade"
        visible
        client={client}
        user={user}
        connectivity="online"
        properties={properties}
        refresh={refresh}
        onClose={jest.fn()}
        busy={false}
        onBusyChange={jest.fn()}
      />,
    );
  });
  const input = (label: string, value: string) =>
    renderer!.root
      .findByProps({ accessibilityLabel: label })
      .props.onChangeText(value);
  const press = (label: string) =>
    renderer!.root.findByProps({ accessibilityLabel: label }).props.onPress();
  await ReactTestRenderer.act(async () => {
    press('Salvar propriedade');
  });
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Informe o nome da propriedade',
  );
  expect(request.mock.calls.filter(call => call[1] === 'POST')).toHaveLength(0);
  await ReactTestRenderer.act(async () => {
    input('Nome da propriedade *', 'Fazenda');
    input('CAR *', 'CAR-123');
    input('Latitude *', '-15,5');
    input('Longitude *', '-47,2');
    input('Área total (ha) *', '100');
    input('Área agricultável (ha) *', '80');
    input('Área de preservação (ha) *', '20');
    input('CEP', '13000-000');
    input('Logradouro / acesso', 'Estrada rural');
    press('SP - São Paulo');
    press('Argiloso');
    press('I Uso');
  });
  await ReactTestRenderer.act(async () => {
    press('Campinas');
  });
  await ReactTestRenderer.act(async () => {
    press('Salvar propriedade');
  });
  expect(request).toHaveBeenCalledWith(
    '/propriedades',
    'POST',
    expect.objectContaining({
      id_empresa: 7,
      nome_propriedade: 'Fazenda',
      id_cidade: 2,
      id_tipo_solo: 5,
      id_classe_capacidade_uso: 9,
    }),
  );
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Cadastro realizado com sucesso',
  );
  await ReactTestRenderer.act(async () => {
    renderer!.unmount();
  });
});

test('envio incerto bloqueia nova tentativa até conferência explícita', async () => {
  const request = jest.fn(async (_path: string, method?: string) => {
    if (method === 'POST') {
      throw new Error('rede');
    }
    return [];
  });
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  const refresh = jest
    .fn()
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  const onClose = jest.fn();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CadastroRural
        kind="talhao"
        visible
        client={client}
        user={user}
        connectivity="online"
        properties={properties}
        refresh={refresh}
        onClose={onClose}
        busy={false}
        onBusyChange={jest.fn()}
      />,
    );
  });
  const input = (label: string, value: string) =>
    renderer!.root
      .findByProps({ accessibilityLabel: label })
      .props.onChangeText(value);
  const press = (label: string) =>
    renderer!.root.findByProps({ accessibilityLabel: label }).props.onPress();
  await ReactTestRenderer.act(async () => {
    input('Nome do talhão *', 'Talhão');
    input('Código do talhão *', 'T-1');
    input('Área total (ha) *', '10');
    press('Minha propriedade');
  });
  await ReactTestRenderer.act(async () => {
    press('Salvar talhão');
  });
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Salvar talhão' }).props
      .disabled,
  ).toBe(true);
  await ReactTestRenderer.act(async () => {
    press('Consultar lista para conferir');
  });
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Salvar talhão' }).props
      .disabled,
  ).toBe(true);
  expect(onClose).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => {
    press('Consultar lista para conferir');
  });
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Salvar talhão' }).props
      .disabled,
  ).toBe(true);
  await ReactTestRenderer.act(async () => {
    press('Confirmei que não foi cadastrado');
  });
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Salvar talhão' }).props
      .disabled,
  ).toBe(false);
  expect(request.mock.calls.filter(call => call[1] === 'POST')).toHaveLength(1);
  await ReactTestRenderer.act(async () => {
    renderer!.unmount();
  });
});

test('catálogo opcional indisponível não bloqueia cadastro e permite nova consulta', async () => {
  const request = jest.fn(async (path: string, method?: string) => {
    if (method === 'POST') {
      return { id_talhao: 15 };
    }
    if (path === '/tipos-solo') {
      throw new Error('indisponível');
    }
    return [];
  });
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CadastroRural
        kind="talhao"
        visible
        client={client}
        user={user}
        connectivity="online"
        properties={properties}
        refresh={jest.fn().mockResolvedValue(true)}
        onClose={jest.fn()}
        busy={false}
        onBusyChange={jest.fn()}
      />,
    );
  });
  const input = (label: string, value: string) =>
    renderer!.root
      .findByProps({ accessibilityLabel: label })
      .props.onChangeText(value);
  const press = (label: string) =>
    renderer!.root.findByProps({ accessibilityLabel: label }).props.onPress();
  expect(
    renderer!.root.findByProps({
      accessibilityLabel: 'Tentar carregar Tipo de solo',
    }),
  ).toBeDefined();
  await ReactTestRenderer.act(async () => {
    press('Tentar carregar Tipo de solo');
  });
  expect(
    request.mock.calls.filter(call => call[0] === '/tipos-solo'),
  ).toHaveLength(2);
  await ReactTestRenderer.act(async () => {
    input('Nome do talhão *', 'Teste');
    input('Código do talhão *', 'T-2');
    input('Área total (ha) *', '10');
    press('Minha propriedade');
  });
  await ReactTestRenderer.act(async () => {
    press('Salvar talhão');
  });
  expect(request).toHaveBeenCalledWith(
    '/talhoes',
    'POST',
    expect.not.objectContaining({ id_tipo_solo: expect.anything() }),
  );
  await ReactTestRenderer.act(async () => {
    renderer!.unmount();
  });
});

test('segundo toque no envio não cria outra requisição', async () => {
  let finish: (value: { id_talhao: number }) => void = () => undefined;
  const request = jest.fn((path: string, method?: string) =>
    method === 'POST'
      ? new Promise(resolve => {
          finish = resolve;
        })
      : Promise.resolve([]),
  );
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CadastroRural
        kind="talhao"
        visible
        client={client}
        user={user}
        connectivity="online"
        properties={properties}
        refresh={jest.fn().mockResolvedValue(true)}
        onClose={jest.fn()}
        busy={false}
        onBusyChange={jest.fn()}
      />,
    );
  });
  const input = (label: string, value: string) =>
    renderer!.root
      .findByProps({ accessibilityLabel: label })
      .props.onChangeText(value);
  const press = (label: string) =>
    renderer!.root.findByProps({ accessibilityLabel: label }).props.onPress();
  await ReactTestRenderer.act(async () => {
    input('Nome do talhão *', 'Teste');
    input('Código do talhão *', 'T-3');
    input('Área total (ha) *', '10');
    press('Minha propriedade');
  });
  await ReactTestRenderer.act(async () => {
    press('Salvar talhão');
    press('Salvar talhão');
    await Promise.resolve();
  });
  expect(request.mock.calls.filter(call => call[1] === 'POST')).toHaveLength(1);
  await ReactTestRenderer.act(async () => {
    finish({ id_talhao: 9 });
  });
  await ReactTestRenderer.act(async () => {
    renderer!.unmount();
  });
});
