import type { Connectivity } from '../sync/connectivity';
import {
  BackendError,
  type BackendClient,
  type Usuario,
} from '../../infra/api/BackendClient';
import type { CadastroKind, CadastroPayload } from './validation';

export type CreateResult =
  | { status: 'created'; id: number }
  | { status: 'rejected'; message: string }
  | { status: 'uncertain'; message: string };

export async function createCadastro(
  client: BackendClient,
  user: Usuario,
  connectivity: Connectivity,
  kind: CadastroKind,
  payload: CadastroPayload,
  timeoutMs = 20000,
): Promise<CreateResult> {
  if (connectivity !== 'online') {
    return {
      status: 'rejected',
      message: 'O cadastro precisa de conexão. Reconecte e tente novamente.',
    };
  }
  try {
    await client.verifySession(user);
  } catch {
    return {
      status: 'rejected',
      message:
        'Não foi possível confirmar a sessão. Verifique a conexão ou entre novamente.',
    };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = client.request<Record<string, unknown>>(
      kind === 'propriedade' ? '/propriedades' : '/talhoes',
      'POST',
      payload,
    );
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    });
    const result = await Promise.race([request, timeout]);
    const id =
      result?.[kind === 'propriedade' ? 'id_propriedade' : 'id_talhao'];
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) {
      throw new Error('Resposta incompleta');
    }
    return { status: 'created', id };
  } catch (error) {
    if (
      error instanceof BackendError &&
      [400, 401, 403, 404, 405, 409, 422].includes(error.status)
    ) {
      return {
        status: 'rejected',
        message:
          error.status === 401 || error.status === 403
            ? 'Sessão inválida ou sem permissão. Entre novamente ou consulte o administrador.'
            : 'O servidor recusou os dados. Confira os campos e tente novamente.',
      };
    }
    return {
      status: 'uncertain',
      message:
        'Não foi possível confirmar se o cadastro foi salvo. Consulte a lista antes de criar novamente para evitar duplicação.',
    };
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
