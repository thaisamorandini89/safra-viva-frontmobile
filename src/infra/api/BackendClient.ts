export interface Usuario {
  id: number;
  nome: string;
  perfil: string;
  id_empresa: number | null;
}

export interface Sessao {
  token: string;
  usuario: Usuario;
}

export class BackendError extends Error {
  constructor(public readonly status: number) {
    super(
      status === 401
        ? 'E-mail ou senha inválidos, ou sessão expirada.'
        : 'Não foi possível concluir a operação no servidor.',
    );
  }
}

export function normalizeBaseUrl(
  value: string,
  allowLocalHttp = false,
): string {
  const url = value.trim().replace(/\/+$/, '');
  const secure = /^https:\/\/[^\s/@?#]+(?::\d+)?$/i.test(url);
  const localHttp =
    /^http:\/\/(?:localhost|127\.0\.0\.1|10\.0\.2\.2)(?::\d+)?$/i.test(url);
  if (!secure && !(__DEV__ && allowLocalHttp && localHttp)) {
    throw new Error(
      'Informe o endereço HTTPS do servidor, sem caminho ou credenciais.',
    );
  }
  return url;
}

export class BackendClient {
  readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly token?: string,
    allowLocalHttp = false,
  ) {
    this.baseUrl = normalizeBaseUrl(baseUrl, allowLocalHttp);
  }

  async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      throw new BackendError(response.status);
    }
    return response.json() as Promise<T>;
  }

  login(email: string, senha: string): Promise<Sessao> {
    return this.request('/auth/login', 'POST', { email, senha });
  }

  async verifySession(user: Usuario): Promise<void> {
    const current = await this.request<Usuario>('/auth/me');
    if (
      current.id !== user.id ||
      current.id_empresa !== user.id_empresa ||
      current.perfil !== user.perfil
    ) {
      throw new Error(
        'A conta ou empresa da sessão foi alterada. Entre novamente.',
      );
    }
  }
}
