import { useEffect, useState } from 'react';
import { addEventListener, refresh } from '@react-native-community/netinfo';
import {
  AppState,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { getConnectivity, type Connectivity } from '../app/sync/connectivity';
import { readSyncSummary, type SyncSummary } from '../app/sync/readSyncSummary';
import { bindQueue } from '../app/sync/bindQueue';
import { SyncService } from '../app/sync/SyncService';
import { BackendClient, type Sessao } from '../infra/api/BackendClient';
import { BackendSyncTransport } from '../infra/api/BackendSyncTransport';
import type { LocalDb } from '../infra/db/LocalDb';
import { openLocalDb } from '../infra/db/openLocalDb';
import { MobileShell } from './MobileShell';

export default function App() {
  const [storageStatus, setStorageStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [connectivity, setConnectivity] = useState<Connectivity>('unknown');
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [localDb, setLocalDb] = useState<LocalDb | null>(null);
  const [server, setServer] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [allowLocalHttp, setAllowLocalHttp] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<{
    client: BackendClient;
    data: Sessao;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = addEventListener(state => {
      if (active) {
        setConnectivity(getConnectivity(state));
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let db: LocalDb | undefined;
    let request = 0;
    const refreshSummary = async () => {
      if (!db) {
        return;
      }
      const currentRequest = ++request;
      try {
        const result = await readSyncSummary(db);
        if (active && currentRequest === request) {
          setSummary(result);
          setSummaryError(false);
        }
      } catch {
        if (active && currentRequest === request) {
          setSummary(null);
          setSummaryError(true);
        }
      }
    };
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setConnectivity('unknown');
        refresh().catch(() => undefined);
        refreshSummary();
      }
    });
    openLocalDb()
      .then(async openedDb => {
        if (!active) {
          await openedDb.close();
          return;
        }
        db = openedDb;
        setLocalDb(openedDb);
        setStorageStatus('ready');
        await refreshSummary();
      })
      .catch(() => {
        if (active) {
          setStorageStatus('error');
        }
      });
    return () => {
      active = false;
      subscription.remove();
      if (db) {
        db.close().catch(() => undefined);
      }
    };
  }, []);

  const storageMessage = {
    loading: 'Preparando armazenamento local...',
    ready: 'Armazenamento local pronto.',
    error:
      'Não foi possível iniciar o armazenamento local. Reinicie o aplicativo.',
  }[storageStatus];
  const connectivityMessage = {
    online: 'Internet disponível.',
    offline: 'Sem acesso à internet.',
    unknown: 'Conectividade desconhecida.',
  }[connectivity];

  async function login() {
    if (!localDb || busy) {
      return;
    }
    setBusy(true);
    setLoginError('');
    try {
      const anonymous = new BackendClient(server, undefined, allowLocalHttp);
      const data = await anonymous.login(email.trim(), password);
      if (
        typeof data.token !== 'string' ||
        !data.token ||
        !Number.isSafeInteger(data.usuario?.id) ||
        typeof data.usuario?.nome !== 'string' ||
        typeof data.usuario?.perfil !== 'string' ||
        (data.usuario?.id_empresa !== null &&
          !Number.isSafeInteger(data.usuario?.id_empresa))
      ) {
        throw new Error('Resposta de autenticação inválida.');
      }
      const client = new BackendClient(
        anonymous.baseUrl,
        data.token,
        allowLocalHttp,
      );
      await bindQueue(localDb, client.baseUrl, String(data.usuario.id));
      await new SyncService(
        localDb,
        new BackendSyncTransport(client),
      ).markInterruptedAsUncertain();
      setPassword('');
      setSession({ client, data });
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? error.message
          : 'Não foi possível conectar ao servidor.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container}>
        {session && localDb ? (
          <MobileShell
            db={localDb}
            client={session.client}
            user={session.data.usuario}
            connectivity={connectivity}
            onLogout={() => setSession(null)}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>SafraViva</Text>
            <Text style={styles.subtitle}>Inteligência para o campo</Text>
            <Text style={styles.description}>{storageMessage}</Text>
            <Text style={styles.description}>{connectivityMessage}</Text>
            {summary && (
              <Text style={styles.description}>
                Fila local: {summary.pending} pendentes, {summary.syncing} em
                envio, {summary.errors} com erro.
              </Text>
            )}
            {summaryError && (
              <Text style={styles.description}>
                Não foi possível consultar a fila local.
              </Text>
            )}
            <Text style={styles.description}>
              Entre para acessar seus dados. Use o endereço HTTPS do servidor.
            </Text>
            <TextInput
              accessibilityLabel="Servidor"
              style={styles.input}
              placeholder="https://servidor.exemplo.com"
              value={server}
              onChangeText={setServer}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {__DEV__ && (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: allowLocalHttp }}
                onPress={() => setAllowLocalHttp(!allowLocalHttp)}
              >
                <Text style={styles.description}>
                  {allowLocalHttp ? '☑' : '☐'} Permitir HTTP local apenas para
                  testes
                </Text>
                {allowLocalHttp && (
                  <Text style={styles.error}>
                    A senha e o token serão enviados sem criptografia. Use
                    somente dados de teste no emulador local.
                  </Text>
                )}
              </Pressable>
            )}
            <TextInput
              accessibilityLabel="E-mail"
              style={styles.input}
              placeholder="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <TextInput
              accessibilityLabel="Senha"
              style={styles.input}
              placeholder="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            {!!loginError && <Text style={styles.error}>{loginError}</Text>}
            <Pressable
              accessibilityRole="button"
              disabled={busy || storageStatus !== 'ready'}
              onPress={login}
              style={styles.button}
            >
              <Text style={styles.buttonText}>
                {busy ? 'Entrando...' : 'Entrar'}
              </Text>
            </Pressable>
            <Text style={styles.description}>
              A sessão é mantida apenas enquanto o aplicativo estiver aberto.
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f8f2',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#245334',
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: '#1e2921',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  description: {
    color: '#4d5c50',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d9e5db',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    color: '#183328',
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#197747',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b83232', marginTop: 12 },
});
