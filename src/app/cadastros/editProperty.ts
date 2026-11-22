import type { BackendClient, Usuario } from '../../infra/api/BackendClient';
import { BackendError } from '../../infra/api/BackendClient';
import type { Connectivity } from '../sync/connectivity';
import { validateCadastro, type CadastroFields } from './validation';

const PROPERTY_FIELDS = [
  'nome_propriedade',
  'car',
  'ccir',
  'nirf',
  'ponto_referencia',
  'latitude',
  'longitude',
  'area_total',
  'area_agricultavel',
  'area_preservacao',
  'area_pastagem',
  'area_vegetacao_nativa',
  'altitude_media',
  'id_tipo_solo',
  'id_classe_capacidade_uso',
  'observacoes',
];
const ADDRESS_FIELDS = [
  'cep',
  'id_estado',
  'id_cidade',
  'logradouro',
  'bairro',
  'numero',
  'complemento',
];
const NULLABLE_FIELDS = [
  'ccir',
  'nirf',
  'ponto_referencia',
  'observacoes',
  'area_pastagem',
  'area_vegetacao_nativa',
  'altitude_media',
  'id_tipo_solo',
  'id_classe_capacidade_uso',
];

export type PropertyDetail = Record<string, unknown> & {
  id_propriedade: number;
  id_empresa: number | null;
};

export async function loadProperty(
  client: BackendClient,
  user: Usuario,
  id: number,
): Promise<PropertyDetail> {
  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    !Number.isSafeInteger(user.id_empresa) ||
    !user.id_empresa ||
    user.id_empresa < 1
  ) {
    throw new Error('Empresa ou propriedade inválida.');
  }
  await client.verifySession(user);
  const property = await client.request<PropertyDetail>(`/propriedades/${id}`);
  if (
    !property ||
    property.id_propriedade !== id ||
    property.id_empresa !== user.id_empresa
  ) {
    throw new Error('Propriedade indisponível para sua empresa.');
  }
  return property;
}

export function propertyFields(property: PropertyDetail): CadastroFields {
  const address =
    property.endereco && typeof property.endereco === 'object'
      ? (property.endereco as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    [...PROPERTY_FIELDS, ...ADDRESS_FIELDS].map(name => {
      const value = ADDRESS_FIELDS.includes(name)
        ? address[name]
        : property[name];
      return [name, value === null || value === undefined ? '' : String(value)];
    }),
  );
}

export function buildPropertyUpdate(
  fields: CadastroFields,
  initial: CadastroFields,
  companyId: number | null,
) {
  const changed = (name: string) =>
    (fields[name] ?? '').trim() !== (initial[name] ?? '').trim();
  const addressChanged = ADDRESS_FIELDS.some(changed);
  const { errors, payload: validated } = validateCadastro(
    'propriedade',
    fields,
    companyId,
    [],
  );
  if (!addressChanged) {
    ADDRESS_FIELDS.forEach(name => delete errors[name]);
  } else {
    if (!validated.cep)
      errors.cep = 'Informe um CEP com 8 dígitos para salvar o endereço.';
    if (!validated.id_cidade)
      errors.id_cidade = 'Selecione uma cidade para salvar o endereço.';
    if (!validated.logradouro)
      errors.logradouro = 'Informe o logradouro para salvar o endereço.';
  }
  const payload: Record<string, string | number | null> = {};
  for (const name of PROPERTY_FIELDS) {
    if (!changed(name)) continue;
    if (validated[name] !== undefined) payload[name] = validated[name];
    else if (NULLABLE_FIELDS.includes(name) && !(fields[name] ?? '').trim())
      payload[name] = null;
  }
  if (addressChanged) {
    for (const name of [
      'cep',
      'id_cidade',
      'logradouro',
      'bairro',
      'numero',
      'complemento',
    ]) {
      if (validated[name] !== undefined) payload[name] = validated[name];
      else if (['bairro', 'numero', 'complemento'].includes(name))
        payload[name] = '';
    }
  }
  return { errors, payload, addressChanged };
}

export async function updateProperty(
  client: BackendClient,
  user: Usuario,
  connectivity: Connectivity,
  id: number,
  payload: Record<string, string | number | null>,
  timeoutMs = 20000,
): Promise<{ status: 'saved' | 'rejected' | 'uncertain'; message: string }> {
  if (connectivity !== 'online')
    return {
      status: 'rejected',
      message: 'A edição precisa de conexão. Reconecte e tente novamente.',
    };
  try {
    await loadProperty(client, user, id);
  } catch {
    return {
      status: 'rejected',
      message:
        'Não foi possível confirmar a sessão e a propriedade. Confira a conexão e tente novamente.',
    };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = client.request<{ id_propriedade: number }>(
      `/propriedades/${id}`,
      'PUT',
      payload,
    );
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    });
    const response = await Promise.race([request, timeout]);
    if (response?.id_propriedade !== id) throw new Error('Resposta incompleta');
    return { status: 'saved', message: 'Propriedade atualizada com sucesso.' };
  } catch (error) {
    if (
      error instanceof BackendError &&
      [400, 401, 403, 404, 405, 409, 422].includes(error.status)
    ) {
      return {
        status: 'rejected',
        message:
          'O servidor recusou a alteração. Confira os dados e sua sessão.',
      };
    }
    return {
      status: 'uncertain',
      message:
        'Não foi possível confirmar o salvamento. Volte à lista e consulte a propriedade antes de tentar novamente.',
    };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
