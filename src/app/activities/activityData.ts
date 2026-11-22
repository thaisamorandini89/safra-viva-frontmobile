import type { BackendClient, Usuario } from '../../infra/api/BackendClient';
import type { LocalRecord } from '../../infra/db/OfflineRepository';

export type ActivityProperty = {
  id_propriedade: number;
  id_empresa: number | null;
  nome_propriedade: string;
};
export type ActivityPlot = { id_talhao: number; id_propriedade: number };
export type ActivityItem = {
  nome?: string | null;
  quantidade?: number | null;
  unidade?: string | null;
  horas?: number | null;
  custo?: number | null;
  baixado?: boolean;
};
export type Activity = {
  id_atividade_agricola: number;
  id_empresa?: number | null;
  id_propriedade: number | null;
  id_talhao: number;
  id_tipo_atividade?: number;
  tipo_atividade: string;
  nome_talhao: string;
  nome_propriedade?: string | null;
  categoria?: string | null;
  data_inicio: string;
  data_fim?: string | null;
  status: string;
  safra: string | null;
  responsavel?: string | null;
  custo_operacao?: number | null;
  custo_total?: number | null;
  observacoes?: string | null;
  insumos?: ActivityItem[];
  maquinas?: ActivityItem[];
};

const validId = (id: unknown): id is number =>
  typeof id === 'number' && Number.isSafeInteger(id) && id > 0;

export function belongsToCompany(
  activity: Activity,
  properties: ActivityProperty[],
  plots: ActivityPlot[],
  companyId: number | null,
): boolean {
  if (
    !validId(companyId) ||
    !validId(activity.id_atividade_agricola) ||
    !validId(activity.id_propriedade) ||
    !validId(activity.id_talhao)
  )
    return false;
  if (
    activity.id_empresa !== null &&
    activity.id_empresa !== undefined &&
    activity.id_empresa !== companyId
  )
    return false;
  return (
    properties.some(
      property =>
        property.id_propriedade === activity.id_propriedade &&
        property.id_empresa === companyId,
    ) &&
    plots.some(
      plot =>
        plot.id_talhao === activity.id_talhao &&
        plot.id_propriedade === activity.id_propriedade,
    )
  );
}

export async function loadActivities(
  client: BackendClient,
  user: Usuario,
): Promise<Activity[]> {
  if (!validId(user.id_empresa)) throw new Error('Empresa inválida');
  await client.verifySession(user);
  const [properties, plots, activities] = await Promise.all([
    client.request<ActivityProperty[]>('/propriedades'),
    client.request<ActivityPlot[]>('/talhoes'),
    client.request<Activity[]>('/atividades'),
  ]);
  if (
    !Array.isArray(properties) ||
    !Array.isArray(plots) ||
    !Array.isArray(activities)
  )
    throw new Error('Resposta inválida');
  return activities.filter(
    activity =>
      activity &&
      belongsToCompany(activity, properties, plots, user.id_empresa),
  );
}

export async function loadActivity(
  client: BackendClient,
  user: Usuario,
  id: number,
): Promise<Activity> {
  if (!validId(id) || !validId(user.id_empresa))
    throw new Error('Atividade inválida');
  await client.verifySession(user);
  const [properties, plots, activity] = await Promise.all([
    client.request<ActivityProperty[]>('/propriedades'),
    client.request<ActivityPlot[]>('/talhoes'),
    client.request<Activity>(`/atividades/${id}`),
  ]);
  if (
    !Array.isArray(properties) ||
    !Array.isArray(plots) ||
    !activity ||
    activity.id_atividade_agricola !== id ||
    !belongsToCompany(activity, properties, plots, user.id_empresa)
  )
    throw new Error('Atividade indisponível');
  return activity;
}

export function visibleLocalActivities(
  local: LocalRecord[],
  remote: Activity[],
): LocalRecord[] {
  const remoteIds = new Set(
    remote.map(activity => String(activity.id_atividade_agricola)),
  );
  return local.filter(
    record =>
      record.sync_status !== 'synced' ||
      !record.server_id ||
      !remoteIds.has(record.server_id),
  );
}

export function recentActivities(activities: Activity[]): Activity[] {
  const dateValue = (value: unknown): number => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      return Number.NEGATIVE_INFINITY;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
      ? date.getTime()
      : Number.NEGATIVE_INFINITY;
  };
  return [...activities]
    .sort((first, second) => {
      const firstDate = dateValue(first.data_inicio);
      const secondDate = dateValue(second.data_inicio);
      return firstDate === secondDate
        ? second.id_atividade_agricola - first.id_atividade_agricola
        : secondDate > firstDate
        ? 1
        : -1;
    })
    .slice(0, 3);
}
