import {
  belongsToCompany,
  loadActivities,
  loadActivity,
  recentActivities,
  visibleLocalActivities,
  type Activity,
} from '../src/app/activities/activityData';
import type { BackendClient, Usuario } from '../src/infra/api/BackendClient';
import type { LocalRecord } from '../src/infra/db/OfflineRepository';

const user: Usuario = {
  id: 1,
  nome: 'Pessoa',
  perfil: 'operador',
  id_empresa: 7,
};
const properties = [
  { id_propriedade: 3, id_empresa: 7, nome_propriedade: 'Fazenda' },
  { id_propriedade: 4, id_empresa: 8, nome_propriedade: 'Outra' },
];
const plots = [
  { id_talhao: 5, id_propriedade: 3 },
  { id_talhao: 6, id_propriedade: 4 },
];
const activity: Activity = {
  id_atividade_agricola: 9,
  id_empresa: null,
  id_propriedade: 3,
  id_talhao: 5,
  tipo_atividade: 'Plantio',
  nome_talhao: 'Norte',
  data_inicio: '2026-11-22',
  status: 'Planejada',
  safra: null,
};

test('admite atividade do web sem empresa somente com vínculo íntegro', () => {
  expect(belongsToCompany(activity, properties, plots, 7)).toBe(true);
  expect(
    belongsToCompany({ ...activity, id_empresa: 7 }, properties, plots, 7),
  ).toBe(true);
  expect(
    belongsToCompany({ ...activity, id_empresa: 8 }, properties, plots, 7),
  ).toBe(false);
  expect(
    belongsToCompany({ ...activity, id_talhao: 6 }, properties, plots, 7),
  ).toBe(false);
  expect(
    belongsToCompany({ ...activity, id_propriedade: 4 }, properties, plots, 7),
  ).toBe(false);
  expect(
    belongsToCompany(
      { ...activity, id_propriedade: null },
      properties,
      plots,
      7,
    ),
  ).toBe(false);
  expect(belongsToCompany(activity, properties, plots, null)).toBe(false);
});

test('carrega lista e detalhe verificando sessão e recusando vínculos divergentes', async () => {
  const request = jest.fn(async (path: string) => {
    if (path === '/propriedades') return properties;
    if (path === '/talhoes') return plots;
    if (path === '/atividades')
      return [
        activity,
        { ...activity, id_atividade_agricola: 10, id_empresa: 8 },
      ];
    if (path === '/atividades/9') return activity;
    if (path === '/atividades/10')
      return { ...activity, id_atividade_agricola: 10, id_empresa: 8 };
    throw new Error('rota inesperada');
  });
  const client = {
    request,
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  expect(await loadActivities(client, user)).toEqual([activity]);
  expect(await loadActivity(client, user, 9)).toEqual(activity);
  await expect(loadActivity(client, user, 10)).rejects.toThrow();
  expect(client.verifySession).toHaveBeenCalledTimes(3);
});

test('falha nos vínculos não é confundida com lista vazia', async () => {
  const client = {
    request: jest.fn(async (path: string) => {
      if (path === '/propriedades') throw new Error('rede');
      return [];
    }),
    verifySession: jest.fn().mockResolvedValue(undefined),
  } as unknown as BackendClient;
  await expect(loadActivities(client, user)).rejects.toThrow();
});

test('deduplica somente pelo ID confirmado e mantém locais em erro ou pendentes', () => {
  const record = (
    localId: string,
    serverId: string | null,
    status: LocalRecord['sync_status'],
  ) => ({
    local_id: localId,
    server_id: serverId,
    sync_status: status,
    data_json: '{}',
    created_at: '',
    updated_at: '',
    device_id: 'local',
    last_error: null,
  });
  const local = [
    record('a', '9', 'synced'),
    record('b', '10', 'synced'),
    record('c', null, 'error'),
    record('d', '9', 'pending'),
  ];
  expect(
    visibleLocalActivities(local, [activity]).map(item => item.local_id),
  ).toEqual(['b', 'c', 'd']);
  expect(visibleLocalActivities(local, []).map(item => item.local_id)).toEqual([
    'a',
    'b',
    'c',
    'd',
  ]);
});

test('prévia ordena por data e ID, deixando datas inválidas por último sem alterar a lista', () => {
  const activities = [
    { ...activity, id_atividade_agricola: 1, data_inicio: '2026-02-30' },
    { ...activity, id_atividade_agricola: 2, data_inicio: '2026-11-22' },
    { ...activity, id_atividade_agricola: 3, data_inicio: '2026-11-22' },
    { ...activity, id_atividade_agricola: 4, data_inicio: '2026-11-23' },
    {
      ...activity,
      id_atividade_agricola: 5,
      data_inicio: null as unknown as string,
    },
  ];
  expect(
    recentActivities(activities).map(item => item.id_atividade_agricola),
  ).toEqual([4, 3, 2]);
  expect(activities.map(item => item.id_atividade_agricola)).toEqual([
    1, 2, 3, 4, 5,
  ]);
  expect(
    recentActivities([activities[0], activities[4]]).map(
      item => item.id_atividade_agricola,
    ),
  ).toEqual([5, 1]);
});
