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
import { BrandMark } from './BrandMark';

export default function App() {
  const [storageStatus, setStorageStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [connectivity, setConnectivity] = useState<Connectivity>('unknown');
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [localDb, setLocalDb] = useState<LocalDb | null>(null);
  const [server, setServer] = useState(__DEV__ ? 'http://127.0.0.1:5000' : '');
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
<<<<<<< Updated upstream
              <Text style={styles.buttonText}>
                {busy ? 'Entrando...' : 'Entrar'}
              </Text>
            </Pressable>
            <Text style={styles.description}>
              A sessão é mantida apenas enquanto o aplicativo estiver aberto.
            </Text>
          </ScrollView>
=======
              <View style={styles.hero}>
                <View pointerEvents="none" style={styles.heroDecoration}>
                  <View style={styles.heroRing} />
                  <View style={styles.heroRingInner} />
                </View>
                <View style={styles.brandRow}>
                  <BrandMark size={44} />
                  <View>
                    <Text style={styles.brand}>SafraViva</Text>
                    <Text style={styles.brandCaption}>
                      INTELIGÊNCIA PARA O CAMPO
                    </Text>
                  </View>
                </View>
                <Text style={styles.heroEyebrow}>DO PLANTIO À COLHEITA</Text>
                <Text style={styles.heroTitle}>
                  Seu campo, mais perto de você.
                </Text>
                <Text style={styles.heroDescription}>
                  Acompanhe sua operação e tenha suas informações sempre à mão.
                </Text>
                <View style={styles.heroAccent} />
              </View>

              <View style={styles.formCard}>
                <View style={styles.welcomeRow}>
                  <View style={styles.welcomeCopy}>
                    <Text style={styles.formEyebrow}>
                      BEM-VINDO AO SAFRAVIVA
                    </Text>
                    <Text style={styles.formTitle}>Vamos começar?</Text>
                    <Text style={styles.formDescription}>
                      Entre com seus dados para acessar sua conta.
                    </Text>
                  </View>
                  <Text
                    style={styles.welcomeIcon}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  >
                    ✦
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Endereço do servidor</Text>
                <TextInput
                  accessibilityLabel="Servidor"
                  style={styles.input}
                  placeholder="https://servidor.exemplo.com"
                  placeholderTextColor="#819389"
                  value={server}
                  onChangeText={setServer}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <Text style={styles.fieldHint}>
                  {__DEV__
                    ? 'Para testes via USB, use o endereço local e habilite HTTP abaixo. Em outros casos, informe HTTPS, sem /api.'
                    : 'Informe o endereço HTTPS, sem /api.'}
                </Text>
                {__DEV__ && (
                  <View style={styles.devOption}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel="Permitir HTTP local apenas para testes"
                      accessibilityState={{ checked: allowLocalHttp }}
                      onPress={() => setAllowLocalHttp(!allowLocalHttp)}
                      style={styles.devRow}
                    >
                      <Text
                        style={[
                          styles.checkbox,
                          allowLocalHttp && styles.checkboxChecked,
                        ]}
                      >
                        {allowLocalHttp ? '✓' : ''}
                      </Text>
                      <Text style={styles.devLabel}>
                        Permitir HTTP local apenas para testes
                      </Text>
                    </Pressable>
                    {allowLocalHttp && (
                      <Text style={styles.devWarning}>
                        A senha e o token serão enviados sem criptografia. Use
                        somente credenciais de teste em ambiente local.
                      </Text>
                    )}
                  </View>
                )}

                <Text style={styles.fieldLabel}>E-mail</Text>
                <TextInput
                  accessibilityLabel="E-mail"
                  style={styles.input}
                  placeholder="seuemail@exemplo.com"
                  placeholderTextColor="#819389"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
                <Text style={styles.fieldLabel}>Senha</Text>
                <View style={styles.passwordField}>
                  <TextInput
                    accessibilityLabel="Senha"
                    style={styles.passwordInput}
                    placeholder="Digite sua senha"
                    placeholderTextColor="#819389"
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!showPassword}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? 'Ocultar senha' : 'Mostrar senha'
                    }
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.passwordToggle}
                  >
                    <Text style={styles.passwordToggleText}>
                      {showPassword ? 'Ocultar' : 'Mostrar'}
                    </Text>
                  </Pressable>
                </View>
                {!!loginError && (
                  <Text accessibilityLiveRegion="polite" style={styles.error}>
                    {loginError}
                  </Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Entrar"
                  accessibilityState={{
                    disabled: busy || storageStatus !== 'ready',
                    busy,
                  }}
                  disabled={busy || storageStatus !== 'ready'}
                  onPress={login}
                  style={[
                    styles.button,
                    (busy || storageStatus !== 'ready') &&
                      styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.buttonText}>
                    {busy ? 'Entrando...' : 'Entrar na minha conta'}
                  </Text>
                  {!busy && (
                    <Text
                      style={styles.buttonArrow}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    >
                      →
                    </Text>
                  )}
                </Pressable>
                <Text style={styles.sessionHint}>
                  Sua sessão permanece ativa enquanto o aplicativo estiver
                  aberto.
                </Text>
              </View>

              <View style={styles.statusCard} accessibilityLiveRegion="polite">
                <View style={styles.statusHeading}>
                  <Text style={styles.statusIcon}>●</Text>
                  <Text style={styles.statusTitle}>STATUS DO APLICATIVO</Text>
                </View>
                <Text style={styles.statusText}>{storageMessage}</Text>
                <Text style={styles.statusText}>{connectivityMessage}</Text>
                {summary && (
                  <Text style={styles.statusText}>
                    Fila local: {summary.pending} pendentes, {summary.syncing}{' '}
                    em envio, {summary.errors} com erro.
                  </Text>
                )}
                {summaryError && (
                  <Text style={styles.statusText}>
                    Não foi possível consultar a fila local.
                  </Text>
                )}
              </View>
              <Text style={styles.footer}>SAFRAVIVA · FEITO PARA O CAMPO</Text>
            </ScrollView>
          </KeyboardAvoidingView>
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#245334',
    fontSize: 32,
=======
    backgroundColor: '#f3f6ef',
    paddingBottom: 28,
  },
  hero: {
    backgroundColor: '#103d2b',
    paddingHorizontal: 26,
    paddingTop: 20,
    paddingBottom: 52,
    overflow: 'hidden',
  },
  heroDecoration: {
    position: 'absolute',
    right: -74,
    top: 52,
    width: 210,
    height: 210,
    opacity: 0.18,
  },
  heroRing: {
    position: 'absolute',
    width: 205,
    height: 205,
    borderWidth: 24,
    borderColor: '#a2c878',
    borderRadius: 105,
  },
  heroRingInner: {
    position: 'absolute',
    top: 48,
    left: 48,
    width: 110,
    height: 110,
    borderWidth: 15,
    borderColor: '#a2c878',
    borderRadius: 55,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: {
    color: '#fff',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandCaption: {
    color: '#b8d2bf',
    fontSize: 9,
>>>>>>> Stashed changes
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
