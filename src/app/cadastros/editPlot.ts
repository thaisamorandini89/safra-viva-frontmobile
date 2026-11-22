import type { BackendClient, Usuario } from '../../infra/api/BackendClient';
import { BackendError } from '../../infra/api/BackendClient';
import type { Connectivity } from '../sync/connectivity';
import { loadProperty, type PropertyDetail } from './editProperty';
import { validateCadastro, type CadastroFields } from './validation';

const FIELDS = [
  'nome_talhao',
  'codigo_talhao',
  'area_total',
  'area_utilizavel',
  'status_inicial',
  'id_tipo_solo',
  'topografia',
  'observacoes',
  'latitude',
  'longitude',
];

export type PlotDetail = Record<string, unknown> & {
  id_talhao: number;
  id_propriedade: number;
};

export async function loadPlot(
  client: BackendClient,
  user: Usuario,
  id: number,
) {
  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    !Number.isSafeInteger(user.id_empresa) ||
    !user.id_empresa ||
    user.id_empresa < 1
  ) {
    throw new Error('Empresa ou talhão inválido.');
  }
  await client.verifySession(user);
  const plot = await client.request<PlotDetail>(`/talhoes/${id}`);
  if (
    !plot ||
    plot.id_talhao !== id ||
    !Number.isSafeInteger(plot.id_propriedade) ||
    plot.id_propriedade < 1
  ) {
    throw new Error('Talhão inválido.');
  }
  const property = await loadProperty(client, user, plot.id_propriedade);
  return { plot, property };
}

export function plotFields(plot: PlotDetail): CadastroFields {
  return Object.fromEntries(
    [...FIELDS, 'id_propriedade'].map(name => {
      const value = plot[name];
      return [name, value === null || value === undefined ? '' : String(value)];
    }),
  );
}

export function buildPlotUpdate(
  fields: CadastroFields,
  initial: CadastroFields,
  companyId: number | null,
  property: PropertyDetail,
) {
  const { errors, payload: validated } = validateCadastro(
    'talhao',
    fields,
    companyId,
    [
      {
        id_propriedade: property.id_propriedade,
        id_empresa: property.id_empresa,
        nome_propriedade: String(property.nome_propriedade ?? ''),
      },
    ],
  );
  if (fields.id_propriedade !== initial.id_propriedade)
    errors.id_propriedade = 'A propriedade não pode ser alterada.';
  const payload: Record<string, string | number | null> = {};
  for (const name of FIELDS) {
    if ((fields[name] ?? '').trim() === (initial[name] ?? '').trim()) continue;
    if (validated[name] !== undefined) payload[name] = validated[name];
    else if (!(fields[name] ?? '').trim() && name !== 'status_inicial')
      payload[name] = null;
    else if (name === 'status_inicial') payload[name] = 'Livre';
  }
  return { errors, payload };
}

export async function updatePlot(
  client: BackendClient,
  user: Usuario,
  connectivity: Connectivity,
  id: number,
  propertyId: number,
  payload: Record<string, string | number | null>,
  timeoutMs = 20000,
): Promise<{ status: 'saved' | 'rejected' | 'uncertain'; message: string }> {
  if (connectivity !== 'online')
    return {
      status: 'rejected',
      message: 'A edição precisa de conexão. Reconecte e tente novamente.',
    };
  try {
    const current = await loadPlot(client, user, id);
    if (current.plot.id_propriedade !== propertyId)
      throw new Error('Propriedade alterada.');
  } catch {
    return {
      status: 'rejected',
      message:
        'Não foi possível confirmar a sessão, o talhão e sua propriedade. Confira a conexão e tente novamente.',
    };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = client.request<{ id_talhao: number }>(
      `/talhoes/${id}`,
      'PUT',
      payload,
    );
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    });
    const response = await Promise.race([request, timeout]);
    if (response?.id_talhao !== id) throw new Error('Resposta incompleta');
    return { status: 'saved', message: 'Talhão atualizado com sucesso.' };
  } catch (error) {
    if (
      error instanceof BackendError &&
      [400, 401, 403, 404, 405, 409, 422].includes(error.status)
    )
      return {
        status: 'rejected',
        message:
          'O servidor recusou a alteração. Confira os dados e sua sessão.',
      };
    return {
      status: 'uncertain',
      message:
        'Não foi possível confirmar o salvamento. Volte à lista e consulte o talhão antes de tentar novamente.',
    };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
