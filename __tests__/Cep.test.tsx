import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import {
  lookupCep,
  normalizeCep,
  resolveCepLocation,
} from '../src/app/cadastros/cep';
import { validateCadastro } from '../src/app/cadastros/validation';
import type { BackendClient, Usuario } from '../src/infra/api/BackendClient';
import { CadastroRural } from '../src/ui/CadastroRural';

const user: Usuario = {
  id: 1,
  nome: 'Pessoa',
  perfil: 'administrador',
  id_empresa: 7,
};
const address = {
  uf: 'SP',
  localidade: 'São Paulo',
  logradouro: 'Praça da Sé',
  bairro: 'Sé',
};
const states = [
  { id: 1, uf: 'SP', nome: 'São Paulo' },
  { id: 2, uf: 'RJ', nome: 'Rio de Janeiro' },
];
const cities = [
  { id: 10, nome: 'São Paulo' },
  { id: 11, nome: 'Campinas' },
];
const originalFetch = globalThis.fetch;

function response(data: unknown, ok = true): Response {
  return { ok, json: async () => data } as Response;
}

function clientWithCatalogs(
  overrides?: (
    path: string,
    method?: string,
    body?: unknown,
  ) => Promise<unknown>,
) {
  const request = jest.fn(
    async (path: string, method?: string, body?: unknown) => {
      if (overrides) return overrides(path, method, body);
      if (path === '/estados') return states;
      if (path === '/estados/1/cidades') return cities;
      if (method === 'POST') return { id_propriedade: 42 };
      return [];
    },
  );
  return { request, verifySession: jest.fn().mockResolvedValue(undefined) };
}

async function renderForm(client: ReturnType<typeof clientWithCatalogs>) {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CadastroRural
        kind="propriedade"
        visible
        client={client as unknown as BackendClient}
        user={user}
        connectivity="online"
        properties={[]}
        refresh={jest.fn().mockResolvedValue(true)}
        onClose={jest.fn()}
        busy={false}
        onBusyChange={jest.fn()}
      />,
    );
  });
  return renderer!;
}

function input(
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
  value: string,
) {
  renderer.root
    .findByProps({ accessibilityLabel: label })
    .props.onChangeText(value);
}

function press(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  return renderer.root
    .findByProps({ accessibilityLabel: label })
    .props.onPress();
}

function fieldValue(
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
): string {
  return renderer.root.findByProps({ accessibilityLabel: label }).props.value;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});

test('normaliza CEPs válidos e recusa outros sem consultar rede', async () => {
  const fetchMock = jest.fn();
  globalThis.fetch = fetchMock;
  expect(normalizeCep(' 01001-000 ')).toBe('01001000');
  expect(normalizeCep('01001000')).toBe('01001000');
  for (const invalid of [
    '',
    '01001-00',
    '01001-0009',
    '01001A000',
    '01001--000',
  ]) {
    await expect(lookupCep(invalid)).rejects.toMatchObject({
      reason: 'invalid',
    });
  }
  expect(fetchMock).not.toHaveBeenCalled();
});

test('consulta ViaCEP sem credenciais, aceita logradouro e bairro ausentes', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValue(response({ uf: 'SP', localidade: 'São Paulo' }));
  globalThis.fetch = fetchMock;
  await expect(lookupCep('01001-000')).resolves.toEqual({
    ...address,
    logradouro: '',
    bairro: '',
  });
  expect(fetchMock).toHaveBeenCalledWith(
    'https://viacep.com.br/ws/01001000/json/',
    {
      signal: expect.anything(),
    },
  );
});

test('classifica CEP inexistente, HTTP inválido, JSON inválido e rede', async () => {
  const fetchMock = jest.fn();
  globalThis.fetch = fetchMock;
  fetchMock.mockResolvedValueOnce(response({ erro: true }));
  await expect(lookupCep('01001000')).rejects.toMatchObject({
    reason: 'not-found',
  });
  fetchMock.mockResolvedValueOnce(response({}, false));
  await expect(lookupCep('01001000')).rejects.toMatchObject({
    reason: 'unavailable',
  });
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.reject(new Error('json')),
  });
  await expect(lookupCep('01001000')).rejects.toMatchObject({
    reason: 'unavailable',
  });
  fetchMock.mockResolvedValueOnce(response({ uf: 'SP' }));
  await expect(lookupCep('01001000')).rejects.toMatchObject({
    reason: 'unavailable',
  });
  fetchMock.mockRejectedValueOnce(new Error('rede'));
  await expect(lookupCep('01001000')).rejects.toMatchObject({
    reason: 'unavailable',
  });
});

test('interrompe a espera quando ViaCEP não responde', async () => {
  jest.useFakeTimers();
  globalThis.fetch = jest.fn(() => new Promise(() => {}));
  const result = lookupCep('01001000', 10).catch(error => error);
  jest.advanceTimersByTime(10);
  expect(await result).toMatchObject({ reason: 'unavailable' });
});

test('usa IDs do backend somente quando estado e cidade têm correspondência única', async () => {
  const request = jest.fn(
    async (path: string): Promise<Record<string, unknown>[]> =>
      path === '/estados'
        ? [{ id: 7, uf: ' sp ', nome: 'São Paulo' }]
        : [
            { id: 23, nome: '  SÃO   PAULO ' },
            { id: 24, nome: 'Outra' },
          ],
  );
  const client = { request } as unknown as BackendClient;
  expect(await resolveCepLocation(client, address)).toMatchObject({
    stateId: 7,
    cityId: 23,
  });
  expect(request).toHaveBeenCalledWith('/estados/7/cidades');
  request.mockImplementationOnce(async () => [
    { id: 1, uf: 'SP' },
    { id: 2, uf: 'SP' },
  ]);
  expect(await resolveCepLocation(client, address)).toMatchObject({
    stateId: null,
    cityId: null,
  });
  request.mockImplementationOnce(async () => [{ id: 7, uf: 'SP' }]);
  request.mockImplementationOnce(async () => [
    { id: 1, nome: 'São Paulo' },
    { id: 2, nome: 'são paulo' },
  ]);
  expect(await resolveCepLocation(client, address)).toMatchObject({
    stateId: 7,
    cityId: null,
  });
  request.mockImplementationOnce(async () => [{ id: 7, uf: 'SP' }]);
  request.mockImplementationOnce(async () => [{ id: 1, nome: 'Campinas' }]);
  expect(await resolveCepLocation(client, address)).toMatchObject({
    stateId: 7,
    cityId: null,
  });
  request.mockRejectedValueOnce(new Error('indisponível'));
  await expect(resolveCepLocation(client, address)).rejects.toThrow();
});

test('formulário busca CEP e envia endereço com cidade interna do backend', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(response(address));
  const client = clientWithCatalogs();
  const renderer = await renderForm(client);
  await ReactTestRenderer.act(async () => {
    input(renderer, 'CEP', '01001-000');
    input(renderer, 'Nome da propriedade *', 'Fazenda');
    input(renderer, 'CAR *', 'CAR');
    input(renderer, 'Latitude *', '-15');
    input(renderer, 'Longitude *', '-47');
    input(renderer, 'Área total (ha) *', '100');
    input(renderer, 'Área agricultável (ha) *', '80');
    input(renderer, 'Área de preservação (ha) *', '20');
  });
  await ReactTestRenderer.act(async () => {
    await press(renderer, 'Buscar CEP');
  });
  expect(fieldValue(renderer, 'Logradouro / acesso')).toBe('Praça da Sé');
  expect(fieldValue(renderer, 'Bairro')).toBe('Sé');
  expect(JSON.stringify(renderer.toJSON())).toContain('CEP consultado');
  await ReactTestRenderer.act(async () => {
    await press(renderer, 'Salvar propriedade');
  });
  expect(client.request).toHaveBeenCalledWith(
    '/propriedades',
    'POST',
    expect.objectContaining({
      cep: '01001000',
      id_cidade: 10,
      logradouro: 'Praça da Sé',
      bairro: 'Sé',
    }),
  );
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('preserva conflitos e aplica sugestões somente após confirmação', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(response(address));
  const client = clientWithCatalogs();
  const renderer = await renderForm(client);
  await ReactTestRenderer.act(async () => {
    input(renderer, 'CEP', '01001000');
    input(renderer, 'Logradouro / acesso', 'Estrada rural');
    press(renderer, 'SP - São Paulo');
  });
  await ReactTestRenderer.act(async () => press(renderer, 'Campinas'));
  await ReactTestRenderer.act(async () => {
    await press(renderer, 'Buscar CEP');
  });
  expect(fieldValue(renderer, 'Logradouro / acesso')).toBe('Estrada rural');
  expect(fieldValue(renderer, 'Bairro')).toBe('Sé');
  expect(
    StyleSheet.flatten(
      renderer.root.findByProps({ accessibilityLabel: 'Campinas' }).props.style,
    ).backgroundColor,
  ).toBe('#cfeada');
  expect(
    renderer.root.findByProps({
      accessibilityLabel: 'Aplicar sugestões do CEP',
    }),
  ).toBeDefined();
  await ReactTestRenderer.act(async () =>
    press(renderer, 'Aplicar sugestões do CEP'),
  );
  expect(fieldValue(renderer, 'Logradouro / acesso')).toBe('Praça da Sé');
  expect(
    StyleSheet.flatten(
      renderer.root.findByProps({ accessibilityLabel: 'São Paulo' }).props
        .style,
    ).backgroundColor,
  ).toBe('#cfeada');
  expect(JSON.stringify(renderer.toJSON())).toContain('Sugestões aplicadas');
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('indisponibilidade, CEP inexistente e catálogo ausente permitem correção manual e nova tentativa', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce(response({ erro: true }))
    .mockResolvedValueOnce(response(address));
  globalThis.fetch = fetchMock;
  const client = clientWithCatalogs(async path => {
    if (path === '/estados') throw new Error('servidor');
    return [];
  });
  const renderer = await renderForm(client);
  await ReactTestRenderer.act(async () => {
    input(renderer, 'CEP', '01001000');
    input(renderer, 'Logradouro / acesso', 'Manual');
  });
  await ReactTestRenderer.act(async () => {
    await press(renderer, 'Buscar CEP');
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('CEP não encontrado');
  expect(fieldValue(renderer, 'Logradouro / acesso')).toBe('Manual');
  await ReactTestRenderer.act(async () => {
    await press(renderer, 'Buscar CEP');
  });
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Selecione estado e cidade manualmente',
  );
  expect(fieldValue(renderer, 'Logradouro / acesso')).toBe('Manual');
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('CEP alterado e formulário fechado invalidam respostas atrasadas', async () => {
  let finish: (value: Response) => void = () => undefined;
  const fetchMock = jest.fn(
    () =>
      new Promise<Response>(resolve => {
        finish = resolve;
      }),
  );
  globalThis.fetch = fetchMock;
  const client = clientWithCatalogs();
  const renderer = await renderForm(client);
  await ReactTestRenderer.act(async () => {
    input(renderer, 'CEP', '01001000');
    press(renderer, 'Buscar CEP');
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Buscar CEP' }).props
      .disabled,
  ).toBe(true);
  await ReactTestRenderer.act(async () => {
    input(renderer, 'CEP', '22222000');
    finish(response(address));
  });
  expect(fieldValue(renderer, 'Logradouro / acesso')).toBe('');
  expect(
    client.request.mock.calls.filter(call => call[0] === '/estados/1/cidades'),
  ).toHaveLength(0);
  await ReactTestRenderer.act(async () => {
    press(renderer, 'Buscar CEP');
  });
  await ReactTestRenderer.act(async () => {
    renderer.update(
      <CadastroRural
        kind="propriedade"
        visible={false}
        client={client as unknown as BackendClient}
        user={user}
        connectivity="online"
        properties={[]}
        refresh={jest.fn()}
        onClose={jest.fn()}
        busy={false}
        onBusyChange={jest.fn()}
      />,
    );
    finish(response(address));
  });
  expect(fieldValue(renderer, 'Logradouro / acesso')).toBe('');
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('resposta da consulta anterior não sobrescreve uma nova consulta concluída', async () => {
  const pending: Array<(value: Response) => void> = [];
  globalThis.fetch = jest.fn(
    () =>
      new Promise<Response>(resolve => {
        pending.push(resolve);
      }),
  );
  const renderer = await renderForm(clientWithCatalogs());
  await ReactTestRenderer.act(async () => {
    input(renderer, 'CEP', '01001000');
    press(renderer, 'Buscar CEP');
  });
  await ReactTestRenderer.act(async () => {
    input(renderer, 'CEP', '01310000');
    press(renderer, 'Buscar CEP');
  });
  expect(pending).toHaveLength(2);
  await ReactTestRenderer.act(async () => {
    pending[1](response({ ...address, logradouro: 'Avenida Paulista' }));
  });
  expect(fieldValue(renderer, 'Logradouro / acesso')).toBe('Avenida Paulista');
  await ReactTestRenderer.act(async () => {
    pending[0](response(address));
  });
  expect(fieldValue(renderer, 'Logradouro / acesso')).toBe('Avenida Paulista');
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('catálogo geográfico indisponível por timeout não bloqueia indefinidamente', async () => {
  jest.useFakeTimers();
  const client = {
    request: jest.fn(() => new Promise(() => {})),
  } as unknown as BackendClient;
  const result = resolveCepLocation(client, address, 10).catch(error => error);
  jest.advanceTimersByTime(10);
  expect(await result).toBeInstanceOf(Error);
});

test('edicao durante consulta preserva texto e exige confirmação para sobrescrever', async () => {
  let finish: (value: Response) => void = () => undefined;
  globalThis.fetch = jest.fn(
    () =>
      new Promise<Response>(resolve => {
        finish = resolve;
      }),
  );
  const renderer = await renderForm(clientWithCatalogs());
  await ReactTestRenderer.act(async () => {
    input(renderer, 'CEP', '01001000');
    press(renderer, 'Buscar CEP');
  });
  await ReactTestRenderer.act(async () => {
    input(renderer, 'Logradouro / acesso', 'Editado durante a busca');
    finish(response(address));
  });
  expect(fieldValue(renderer, 'Logradouro / acesso')).toBe(
    'Editado durante a busca',
  );
  expect(
    renderer.root.findByProps({
      accessibilityLabel: 'Aplicar sugestões do CEP',
    }),
  ).toBeDefined();
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('seleção manual durante carregamento de cidades invalida a sugestão de CEP', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(response(address));
  let finishCities: (value: unknown) => void = () => undefined;
  let cityCalls = 0;
  const client = clientWithCatalogs(async path => {
    if (path === '/estados') return states;
    if (path === '/estados/1/cidades') {
      cityCalls += 1;
      if (cityCalls === 1)
        return new Promise(resolve => {
          finishCities = resolve;
        });
      return cities;
    }
    return [];
  });
  const renderer = await renderForm(client);
  await ReactTestRenderer.act(async () => {
    input(renderer, 'CEP', '01001000');
    press(renderer, 'Buscar CEP');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(cityCalls).toBe(1);
  await ReactTestRenderer.act(async () => {
    press(renderer, 'SP - São Paulo');
  });
  await ReactTestRenderer.act(async () => {
    press(renderer, 'Campinas');
    finishCities(cities);
  });
  expect(fieldValue(renderer, 'Logradouro / acesso')).toBe('');
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: 'Aplicar sugestões do CEP',
    }),
  ).toHaveLength(0);
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Campinas' }),
  ).toBeDefined();
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('busca inválida e valores parciais preservam os campos manuais', async () => {
  const fetchMock = jest.fn().mockResolvedValue(
    response({
      uf: 'SP',
      localidade: 'São Paulo',
      logradouro: '',
      bairro: '',
    }),
  );
  globalThis.fetch = fetchMock;
  const renderer = await renderForm(clientWithCatalogs());
  await ReactTestRenderer.act(async () => {
    input(renderer, 'CEP', '123');
    input(renderer, 'Logradouro / acesso', 'Estrada rural');
    input(renderer, 'Bairro', 'Rural');
    press(renderer, 'Buscar CEP');
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('Informe um CEP válido');
  expect(fetchMock).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => {
    input(renderer, 'CEP', '01001000');
  });
  await ReactTestRenderer.act(async () => {
    await press(renderer, 'Buscar CEP');
  });
  expect(fieldValue(renderer, 'Logradouro / acesso')).toBe('Estrada rural');
  expect(fieldValue(renderer, 'Bairro')).toBe('Rural');
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('validação mantém endereço opcional e rejeita CEP parcial ou com letras', () => {
  const fields = {
    nome_propriedade: 'Teste',
    car: 'CAR',
    latitude: '-15',
    longitude: '-47',
    area_total: '10',
    area_agricultavel: '8',
    area_preservacao: '2',
  };
  expect(validateCadastro('propriedade', fields, 7, []).errors).toEqual({});
  expect(
    validateCadastro(
      'propriedade',
      { ...fields, cep: '01001A000', id_cidade: '10', logradouro: 'Rua' },
      7,
      [],
    ).errors.cep,
  ).toBeTruthy();
  expect(
    validateCadastro('propriedade', { ...fields, cep: '01001000' }, 7, [])
      .errors,
  ).toMatchObject({
    id_cidade: expect.any(String),
    logradouro: expect.any(String),
  });
});
