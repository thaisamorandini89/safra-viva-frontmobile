import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { addEventListener, refresh, type NetInfoState } from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';
import App from '../App';
import { BrandMark } from '../src/ui/BrandMark';
import { getConnectivity } from '../src/app/sync/connectivity';
import { openLocalDb } from '../src/infra/db/openLocalDb';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  refresh: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/infra/db/openLocalDb', () => ({ openLocalDb: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

test.each([
  [true, true, 'online'],
  [false, null, 'offline'],
  [true, false, 'offline'],
  [null, false, 'offline'],
  [true, null, 'unknown'],
  [null, true, 'unknown'],
  [null, null, 'unknown'],
] as const)('interpreta conectividade %s / %s como %s', (isConnected, isInternetReachable, expected) => {
  expect(getConnectivity({ isConnected, isInternetReachable })).toBe(expected);
});

test('exibe conectividade e fila, atualiza ao retornar e remove assinaturas', async () => {
  let onNetwork: (state: NetInfoState) => void = () => undefined;
  let onAppState: (state: AppStateStatus) => void = () => undefined;
  const unsubscribe = jest.fn();
  const remove = jest.fn();
  const query = jest.fn()
    .mockResolvedValueOnce([{ pending: 2, syncing: 1, errors: 3 }])
    .mockRejectedValueOnce(new Error('falha'))
    .mockResolvedValueOnce([{ pending: 0, syncing: 0, errors: 0 }]);
  const close = jest.fn().mockResolvedValue(undefined);
  (addEventListener as jest.Mock).mockImplementation(callback => {
    onNetwork = callback;
    return unsubscribe;
  });
  const appStateSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
    onAppState = callback;
    return { remove };
  });
  (openLocalDb as jest.Mock).mockResolvedValue({ query, close });
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
<<<<<<< Updated upstream
  expect(JSON.stringify(renderer!.toJSON())).toContain('Conectividade desconhecida.');
=======
  expect(renderer!.root.findAllByType(BrandMark)).toHaveLength(1);
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'Conectividade desconhecida.',
  );
>>>>>>> Stashed changes
  expect(JSON.stringify(renderer!.toJSON())).toContain('pendentes');
  expect(JSON.stringify(renderer!.toJSON())).toContain('com erro');

  await ReactTestRenderer.act(async () => {
    onAppState('active');
    onNetwork({ isConnected: true, isInternetReachable: true } as NetInfoState);
  });
  expect(refresh).toHaveBeenCalled();
  expect(JSON.stringify(renderer!.toJSON())).toContain('Internet disponível.');
  expect(JSON.stringify(renderer!.toJSON())).toContain('Não foi possível consultar a fila local.');
  expect(JSON.stringify(renderer!.toJSON())).not.toContain('pendentes');

  await ReactTestRenderer.act(async () => {
    onAppState('active');
    onNetwork({ isConnected: false, isInternetReachable: null } as NetInfoState);
  });
  expect(JSON.stringify(renderer!.toJSON())).toContain('Sem acesso à internet.');
  expect(JSON.stringify(renderer!.toJSON())).toContain('pendentes');
  await ReactTestRenderer.act(async () => renderer!.unmount());
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
  appStateSpy.mockRestore();
});

test('fecha banco que termina de abrir após desmontagem', async () => {
  let finishOpening: (db: { close: jest.Mock }) => void = () => undefined;
  const close = jest.fn().mockResolvedValue(undefined);
  (addEventListener as jest.Mock).mockReturnValue(jest.fn());
  const appStateSpy = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  (openLocalDb as jest.Mock).mockReturnValue(new Promise(resolve => { finishOpening = resolve; }));
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => { renderer = ReactTestRenderer.create(<App />); });
  await ReactTestRenderer.act(async () => { renderer!.unmount(); });
  await ReactTestRenderer.act(async () => { finishOpening({ close }); });
  expect(close).toHaveBeenCalledTimes(1);
  appStateSpy.mockRestore();
});
<<<<<<< Updated upstream
=======

test('login preserva a integração, opção de teste local e controle de senha', async () => {
  (addEventListener as jest.Mock).mockReturnValue(jest.fn());
  const appStateSpy = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() });
  (openLocalDb as jest.Mock).mockResolvedValue({
    query: jest.fn().mockResolvedValue([{ pending: 0, syncing: 0, errors: 0 }]),
    close: jest.fn().mockResolvedValue(undefined),
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = jest
    .fn()
    .mockResolvedValue({ ok: false, status: 401 }) as typeof fetch;
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const root = renderer!.root;
  expect(root.findByProps({ accessibilityLabel: 'Servidor' }).props.value).toBe(
    'http://127.0.0.1:5000',
  );
  expect(
    root.findByProps({
      accessibilityLabel: 'Permitir HTTP local apenas para testes',
    }).props.accessibilityState.checked,
  ).toBe(false);
  await ReactTestRenderer.act(async () => {
    root
      .findByProps({ accessibilityLabel: 'Servidor' })
      .props.onChangeText('https://servidor.exemplo.com');
  });
  expect(root.findByProps({ accessibilityLabel: 'Servidor' }).props.value).toBe(
    'https://servidor.exemplo.com',
  );
  expect(
    root.findByProps({ accessibilityLabel: 'Senha' }).props.secureTextEntry,
  ).toBe(true);
  await ReactTestRenderer.act(async () =>
    root.findByProps({ accessibilityLabel: 'Mostrar senha' }).props.onPress(),
  );
  expect(
    root.findByProps({ accessibilityLabel: 'Senha' }).props.secureTextEntry,
  ).toBe(false);
  await ReactTestRenderer.act(async () =>
    root.findByProps({ accessibilityLabel: 'Ocultar senha' }).props.onPress(),
  );
  expect(
    root.findByProps({ accessibilityLabel: 'Senha' }).props.secureTextEntry,
  ).toBe(true);
  await ReactTestRenderer.act(async () => {
    root
      .findByProps({ accessibilityLabel: 'Servidor' })
      .props.onChangeText('http://127.0.0.1:5000');
    root
      .findByProps({ accessibilityLabel: 'E-mail' })
      .props.onChangeText('teste@example.com');
    root
      .findByProps({ accessibilityLabel: 'Senha' })
      .props.onChangeText('senha-teste');
  });
  await ReactTestRenderer.act(async () =>
    root.findByProps({ accessibilityLabel: 'Entrar' }).props.onPress(),
  );
  expect(globalThis.fetch).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () =>
    root
      .findByProps({
        accessibilityLabel: 'Permitir HTTP local apenas para testes',
      })
      .props.onPress(),
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain('sem criptografia');
  await ReactTestRenderer.act(async () =>
    root.findByProps({ accessibilityLabel: 'Entrar' }).props.onPress(),
  );
  expect(globalThis.fetch).toHaveBeenCalledWith(
    'http://127.0.0.1:5000/api/auth/login',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        email: 'teste@example.com',
        senha: 'senha-teste',
      }),
    }),
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    'E-mail ou senha inválidos',
  );
  await ReactTestRenderer.act(async () => renderer!.unmount());
  globalThis.fetch = originalFetch;
  appStateSpy.mockRestore();
});
>>>>>>> Stashed changes
