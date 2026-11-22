import {
  BackendClient,
  BackendError,
  normalizeBaseUrl,
} from '../src/infra/api/BackendClient';
import { BackendSyncTransport } from '../src/infra/api/BackendSyncTransport';
import type { SyncEvent } from '../src/app/sync/SyncService';

const event: SyncEvent = {
  id: 'event-1',
  entityType: 'atividade_agricola',
  entityLocalId: 'local-1',
  operation: 'create',
  payload: '{"id_talhao":7}',
  serverId: null,
};

const fetchMock = jest.fn();
beforeEach(() => {
  globalThis.fetch = fetchMock as typeof fetch;
  fetchMock.mockReset();
});

test('exige HTTPS e normaliza o endereço sem caminhos', () => {
  expect(normalizeBaseUrl(' https://example.com:443/ ')).toBe(
    'https://example.com:443',
  );
  for (const invalid of [
    'http://example.com',
    'https://user:pass@example.com',
    'https://example.com/api',
  ]) {
    expect(() => normalizeBaseUrl(invalid)).toThrow();
  }
  expect(normalizeBaseUrl('http://10.0.2.2:5000', true)).toBe(
    'http://10.0.2.2:5000',
  );
  expect(() => normalizeBaseUrl('http://10.0.2.2:5000')).toThrow();
  expect(() => normalizeBaseUrl('http://192.168.1.1:5000', true)).toThrow();
});

test('autentica com o contrato real e inclui o token nas requisições', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ token: 'token', usuario: { id: 2, id_empresa: 3 } }),
  });
  const anonymous = new BackendClient('https://example.com');
  const session = await anonymous.login('a@b.com', 'senha');
  expect(fetchMock).toHaveBeenCalledWith(
    'https://example.com/api/auth/login',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.com', senha: 'senha' }),
    }),
  );
  const client = new BackendClient(anonymous.baseUrl, session.token);
  fetchMock.mockResolvedValue({ ok: true, json: async () => session.usuario });
  await client.verifySession(session.usuario);
  expect(fetchMock).toHaveBeenLastCalledWith(
    'https://example.com/api/auth/me',
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer token' }),
    }),
  );
  await expect(
    client.verifySession({ ...session.usuario, id_empresa: 4 }),
  ).rejects.toThrow('alterada');
});

test('envia criação com ID retornado pelo backend e atualização para o recurso correto', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ id_atividade_agricola: 42 }),
  });
  const transport = new BackendSyncTransport(
    new BackendClient('https://example.com', 'token'),
  );
  await expect(transport.send(event)).resolves.toEqual({
    kind: 'success',
    serverId: '42',
  });
  expect(fetchMock).toHaveBeenCalledWith(
    'https://example.com/api/atividades',
    expect.objectContaining({ method: 'POST', body: event.payload }),
  );
  await expect(
    transport.send({ ...event, operation: 'update', serverId: '42' }),
  ).resolves.toEqual({ kind: 'success' });
  expect(fetchMock).toHaveBeenLastCalledWith(
    'https://example.com/api/atividades/42',
    expect.objectContaining({ method: 'PUT' }),
  );
});

test('nunca reenvia automaticamente resultado incerto e rejeita operações não suportadas', async () => {
  const transport = new BackendSyncTransport(
    new BackendClient('https://example.com'),
  );
  fetchMock.mockRejectedValueOnce(new Error('rede'));
  await expect(transport.send(event)).resolves.toEqual({ kind: 'unknown' });
  fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
  await expect(transport.send(event)).resolves.toEqual({ kind: 'unknown' });
  fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });
  await expect(transport.send(event)).resolves.toEqual({ kind: 'rejected' });
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  await expect(transport.send(event)).resolves.toEqual({ kind: 'unknown' });
  await expect(
    transport.send({
      ...event,
      entityType: 'movimentacao_estoque',
      operation: 'update',
      serverId: '1',
    }),
  ).resolves.toEqual({ kind: 'rejected' });
});

test('não expõe corpo de erro do servidor', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 500 });
  await expect(
    new BackendClient('https://example.com').request('/atividades'),
  ).rejects.toEqual(new BackendError(500));
});
