import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';
import {
  buildPropertyUpdate,
  loadProperty,
  propertyFields,
  updateProperty,
} from '../src/app/cadastros/editProperty';
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
const property = {
  id_propriedade: 3,
  id_empresa: 7,
  nome_propriedade: 'Fazenda',
  car: 'CAR',
  latitude: -15,
  longitude: -47,
  area_total: 20,
  area_agricultavel: 10,
  area_preservacao: 0,
  area_pastagem: 2,
  observacoes: 'Anterior',
  endereco: {
    cep: '01001000',
    id_estado: 1,
    id_cidade: 10,
    logradouro: 'Praça',
    bairro: 'Sé',
    numero: '1',
    complemento: null,
  },
};

test('preenche o registro e envia só alterações, incluindo zero e limpeza de opcionais', () => {
  const initial = propertyFields(property);
  const result = buildPropertyUpdate(
    {
      ...initial,
      nome_propriedade: 'Nova',
      area_pastagem: '0',
      observacoes: '',
    },
    initial,
    7,
  );
  expect(result.errors).toEqual({});
  expect(result.payload).toEqual({
    nome_propriedade: 'Nova',
    area_pastagem: 0,
    observacoes: null,
  });
});

test('endereço alterado é completo e endereço inalterado não é enviado', () => {
  const initial = propertyFields(property);
  const result = buildPropertyUpdate({ ...initial, numero: '2' }, initial, 7);
  expect(result.payload).toEqual({
    cep: '01001000',
    id_cidade: 10,
    logradouro: 'Praça',
    bairro: 'Sé',
    numero: '2',
    complemento: '',
  });
  const incomplete = buildPropertyUpdate(
    { ...initial, logradouro: '' },
    initial,
    7,
  );
  expect(incomplete.errors.logradouro).toBeTruthy();
  const oldIncomplete = { ...initial, id_cidade: '' };
  expect(
    buildPropertyUpdate({ ...oldIncomplete, car: 'Novo' }, oldIncomplete, 7)
      .errors,
  ).toEqual({});
});

test('verifica sessão e empresa ao carregar e antes de atualizar', async () => {
  const request = jest
    .fn()
    .mockResolvedValueOnce(property)
    .mockResolvedValueOnce({ ...property, id_empresa: 8 });
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  expect(await loadProperty(client, user, 3)).toEqual(property);
  expect(
    (await updateProperty(client, user, 'online', 3, { car: 'X' })).status,
  ).toBe('rejected');
  expect(request).toHaveBeenCalledTimes(2);
  await expect(
    loadProperty(client, { ...user, id_empresa: null }, 3),
  ).rejects.toThrow();
});

test('classifica sucesso, rejeição e resultado incerto sem repetir PUT', async () => {
  const request = jest.fn(async (_path: string, method?: string) => {
    if (method === 'PUT') throw new BackendError(500);
    return property;
  });
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  expect(
    (await updateProperty(client, user, 'online', 3, { car: 'X' })).status,
  ).toBe('uncertain');
  expect(request.mock.calls.filter(call => call[1] === 'PUT')).toHaveLength(1);
  request.mockImplementation(async (_path, method) => {
    if (method === 'PUT') throw new BackendError(400);
    return property;
  });
  expect(
    (await updateProperty(client, user, 'online', 3, { car: 'X' })).status,
  ).toBe('rejected');
  request.mockImplementation(async (_path, method) =>
    method === 'PUT' ? ({ id_propriedade: 3 } as typeof property) : property,
  );
  expect(
    (await updateProperty(client, user, 'online', 3, { car: 'X' })).status,
  ).toBe('saved');
  expect(
    (await updateProperty(client, user, 'offline', 3, { car: 'X' })).status,
  ).toBe('rejected');
});

test('timeout após envio não repete o PUT', async () => {
  jest.useFakeTimers();
  const request = jest.fn(async (_path: string, method?: string) => {
    if (method === 'PUT') return new Promise(() => {});
    return property;
  });
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  const result = updateProperty(client, user, 'online', 3, { car: 'X' }, 10);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  jest.advanceTimersByTime(10);
  expect((await result).status).toBe('uncertain');
  expect(request.mock.calls.filter(call => call[1] === 'PUT')).toHaveLength(1);
  jest.useRealTimers();
});

test('catálogo de cidade indisponível bloqueia alteração de endereço sem apagar valores', async () => {
  const request = jest.fn(async (path: string) => {
    if (path === '/estados/1/cidades') throw new Error('rede');
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
        kind="propriedade"
        visible
        client={client}
        user={user}
        connectivity="online"
        properties={[]}
        refresh={jest.fn()}
        onClose={jest.fn()}
        busy={false}
        onBusyChange={jest.fn()}
        edit={{ id: 3, initial: propertyFields(property), onSaved: jest.fn() }}
      />,
    );
  });
  await ReactTestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Número' })
      .props.onChangeText('2');
  });
  await ReactTestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: 'Salvar propriedade' })
      .props.onPress();
  });
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Selecione uma cidade disponível',
  );
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Logradouro / acesso' })
      .props.value,
  ).toBe('Praça');
  expect(request.mock.calls.every(call => call[0] !== '/propriedades/3')).toBe(
    true,
  );
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('edição preserva o formulário, confirma descarte e salva somente a alteração', async () => {
  const request = jest.fn(async (path: string, method?: string) => {
    if (method === 'PUT') return { id_propriedade: 3 };
    if (path === '/propriedades/3') return property;
    if (path === '/estados/1/cidades') return [{ id: 10, nome: 'São Paulo' }];
    return [];
  });
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  const onClose = jest.fn();
  const onSaved = jest.fn();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CadastroRural
        kind="propriedade"
        visible
        client={client}
        user={user}
        connectivity="online"
        properties={[]}
        refresh={jest.fn().mockResolvedValue(false)}
        onClose={onClose}
        busy={false}
        onBusyChange={jest.fn()}
        edit={{ id: 3, initial: propertyFields(property), onSaved }}
      />,
    );
  });
  await ReactTestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Nome da propriedade *' })
      .props.onChangeText('Fazenda nova');
  });
  await ReactTestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Voltar para lista' })
      .props.onPress();
  });
  expect(alert).toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: 'Salvar propriedade' })
      .props.onPress();
  });
  expect(request).toHaveBeenCalledWith('/propriedades/3', 'PUT', {
    nome_propriedade: 'Fazenda nova',
  });
  expect(onSaved).toHaveBeenCalledWith(false);
  alert.mockRestore();
  await ReactTestRenderer.act(async () => renderer!.unmount());
});
