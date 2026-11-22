import type {
  DeliveryResult,
  SyncEvent,
  SyncTransport,
} from '../../app/sync/SyncService';
import { BackendClient, BackendError } from './BackendClient';

export class BackendSyncTransport implements SyncTransport {
  constructor(private readonly client: BackendClient) {}

  async send(event: SyncEvent): Promise<DeliveryResult> {
    const collection =
      event.entityType === 'atividade_agricola'
        ? '/atividades'
        : '/movimentacoes';
    if (
      event.entityType === 'movimentacao_estoque' &&
      event.operation !== 'create'
    ) {
      return { kind: 'rejected' };
    }
    if (event.operation !== 'create' && !/^\d+$/.test(event.serverId ?? '')) {
      return { kind: 'rejected' };
    }
    let payload: unknown;
    try {
      payload = JSON.parse(event.payload);
    } catch {
      return { kind: 'rejected' };
    }
    const method = { create: 'POST', update: 'PUT', delete: 'DELETE' }[
      event.operation
    ];
    const path =
      event.operation === 'create'
        ? collection
        : `${collection}/${event.serverId}`;
    try {
      const result = await this.client.request<Record<string, unknown>>(
        path,
        method,
        event.operation === 'delete' ? undefined : payload,
      );
      if (event.operation !== 'create') {
        return { kind: 'success' };
      }
      const id =
        result[
          event.entityType === 'atividade_agricola'
            ? 'id_atividade_agricola'
            : 'id_movimentacao'
        ];
      return typeof id === 'number' && Number.isSafeInteger(id) && id > 0
        ? { kind: 'success', serverId: String(id) }
        : { kind: 'unknown' };
    } catch (error) {
      if (
        error instanceof BackendError &&
        (error.status === 400 || error.status === 422)
      ) {
        return { kind: 'rejected' };
      }
      return { kind: 'unknown' };
    }
  }
}
