import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { addEventListener, refresh, type NetInfoState } from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';
import App from '../App';
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
  expect(JSON.stringify(renderer!.toJSON())).toContain('Conectividade desconhecida.');
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
