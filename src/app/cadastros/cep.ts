import type { BackendClient } from '../../infra/api/BackendClient';

export type CepAddress = {
  logradouro: string;
  bairro: string;
  uf: string;
  localidade: string;
};

export type GeoOption = { id: number; label: string };
export type GeoSuggestion = {
  stateId: number | null;
  cityId: number | null;
  states: GeoOption[];
  cities: GeoOption[];
};

export class CepError extends Error {
  constructor(public readonly reason: 'invalid' | 'not-found' | 'unavailable') {
    super(reason);
  }
}

export function normalizeCep(value: string): string | null {
  const text = value.trim();
  if (!/^\d{5}-?\d{3}$/.test(text)) {
    return null;
  }
  return text.replace('-', '');
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function lookupCep(
  value: string,
  timeoutMs = 15000,
): Promise<CepAddress> {
  const cep = normalizeCep(value);
  if (!cep) throw new CepError('invalid');
  const controller = new AbortController();
  try {
    const data = await withTimeout(
      (async () => {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('HTTP');
        return response.json() as Promise<unknown>;
      })(),
      timeoutMs,
    );
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Resposta inválida');
    }
    const row = data as Record<string, unknown>;
    if (row.erro === true || row.erro === 'true')
      throw new CepError('not-found');
    if (
      typeof row.uf !== 'string' ||
      typeof row.localidade !== 'string' ||
      !row.uf.trim() ||
      !row.localidade.trim()
    ) {
      throw new Error('Resposta incompleta');
    }
    return {
      uf: row.uf.trim(),
      localidade: row.localidade.trim(),
      logradouro:
        typeof row.logradouro === 'string' ? row.logradouro.trim() : '',
      bairro: typeof row.bairro === 'string' ? row.bairro.trim() : '',
    };
  } catch (error) {
    if (error instanceof CepError) throw error;
    throw new CepError('unavailable');
  } finally {
    controller.abort();
  }
}

function normalizedName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export async function resolveCepLocation(
  client: BackendClient,
  address: CepAddress,
  timeoutMs = 15000,
): Promise<GeoSuggestion> {
  const rows = await withTimeout(
    client.request<Record<string, unknown>[]>('/estados'),
    timeoutMs,
  );
  if (!Array.isArray(rows)) throw new Error('Catálogo inválido');
  const states = rows
    .map(row => ({
      id: Number(row.id),
      label: `${row.uf ?? ''} - ${row.nome ?? ''}`,
    }))
    .filter(option => Number.isSafeInteger(option.id) && option.id > 0);
  const matches = rows.filter(
    row =>
      typeof row.uf === 'string' &&
      normalizedName(row.uf) === normalizedName(address.uf) &&
      Number.isSafeInteger(Number(row.id)) &&
      Number(row.id) > 0,
  );
  if (matches.length !== 1)
    return { stateId: null, cityId: null, states, cities: [] };
  const stateId = Number(matches[0].id);
  const cityRows = await withTimeout(
    client.request<Record<string, unknown>[]>(`/estados/${stateId}/cidades`),
    timeoutMs,
  );
  if (!Array.isArray(cityRows)) throw new Error('Catálogo inválido');
  const cities = cityRows
    .map(row => ({
      id: Number(row.id),
      label: typeof row.nome === 'string' ? row.nome.trim() : '',
    }))
    .filter(
      option =>
        Number.isSafeInteger(option.id) && option.id > 0 && !!option.label,
    );
  const matchingCities = cities.filter(
    option =>
      normalizedName(option.label) === normalizedName(address.localidade),
  );
  return {
    stateId,
    cityId: matchingCities.length === 1 ? matchingCities[0].id : null,
    states,
    cities,
  };
}
