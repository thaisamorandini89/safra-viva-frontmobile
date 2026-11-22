import type { BackendClient, Usuario } from '../../infra/api/BackendClient';

export type SupplyProperty = {
  id_propriedade: number;
  id_empresa: number | null;
  nome_propriedade: string;
};

export type SupplyLot = {
  id_lote: number;
  numero_lote: string | null;
  quantidade: number;
  data_validade: string | null;
};

export type Supply = {
  id_insumo: number;
  id_produto: number;
  id_propriedade: number | null;
  nome_produto: string;
  nome_propriedade: string;
  categoria_nome: string;
  unidade_medida: string;
  estoque_atual: number;
  estoque_minimo: number;
  valor_unitario: number;
  status: boolean;
  lotes: SupplyLot[];
};

export type Movement = {
  id_movimentacao: string;
  id_insumo: number;
  tipo_movimentacao: string;
  quantidade: number;
  data_movimentacao: string | null;
  observacao: string | null;
};

function validId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export async function verifiedProperties(client: BackendClient, user: Usuario) {
  await client.verifySession(user);
  const properties = await client.request<SupplyProperty[]>('/propriedades');
  if (!Array.isArray(properties) || !validId(user.id_empresa)) {
    throw new Error('Não foi possível verificar a empresa e as propriedades.');
  }
  if (properties.some(item => !item || !validId(item.id_propriedade))) {
    throw new Error('Não foi possível verificar as propriedades.');
  }
  if (
    properties.some(
      item => item.id_empresa !== null && !validId(item.id_empresa),
    )
  ) {
    throw new Error('Não foi possível verificar a empresa das propriedades.');
  }
  const duplicates = new Set<number>();
  const seen = new Set<number>();
  properties.forEach(item => {
    if (seen.has(item.id_propriedade)) duplicates.add(item.id_propriedade);
    seen.add(item.id_propriedade);
  });
  return properties.filter(
    item =>
      item.id_empresa === user.id_empresa &&
      !duplicates.has(item.id_propriedade),
  );
}

export function eligibleSupply(item: Supply, properties: SupplyProperty[]) {
  return (
    !!item &&
    validId(item.id_insumo) &&
    validId(item.id_produto) &&
    validId(item.id_propriedade) &&
    properties.some(property => property.id_propriedade === item.id_propriedade)
  );
}

function validSupplyData(item: Supply) {
  return (
    typeof item.nome_produto === 'string' &&
    typeof item.unidade_medida === 'string' &&
    Number.isFinite(item.estoque_atual) &&
    Number.isFinite(item.estoque_minimo) &&
    Number.isFinite(item.valor_unitario) &&
    Array.isArray(item.lotes)
  );
}

export async function loadSupplies(client: BackendClient, user: Usuario) {
  const properties = await verifiedProperties(client, user);
  const items = await client.request<Supply[]>('/insumos');
  if (!Array.isArray(items)) throw new Error('Resposta de insumos inválida.');
  if (
    items.some(
      item =>
        properties.some(
          property => property.id_propriedade === item?.id_propriedade,
        ) &&
        (!eligibleSupply(item, properties) || !validSupplyData(item)),
    )
  )
    throw new Error('Resposta de insumos inválida.');
  return {
    properties,
    items: items.filter(item => eligibleSupply(item, properties)),
  };
}

export async function loadVerifiedSupply(
  client: BackendClient,
  user: Usuario,
  id: number,
) {
  const properties = await verifiedProperties(client, user);
  const item = await client.request<Supply>(`/insumos/${id}`);
  if (
    !eligibleSupply(item, properties) ||
    !validSupplyData(item) ||
    item.id_insumo !== id
  ) {
    throw new Error('Não foi possível confirmar o vínculo do insumo.');
  }
  return item;
}
