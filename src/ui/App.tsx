import { useEffect, useState } from 'react';
import { addEventListener, refresh } from '@react-native-community/netinfo';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
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
  const [showPassword, setShowPassword] = useState(false);
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
      setShowPassword(false);
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
      <StatusBar barStyle={session ? 'dark-content' : 'light-content'} />
      <SafeAreaView
        style={[styles.container, !session && styles.loginContainer]}
      >
        {session && localDb ? (
          <MobileShell
            db={localDb}
            client={session.client}
            user={session.data.usuario}
            connectivity={connectivity}
            onLogout={() => setSession(null)}
          />
        ) : (
          <KeyboardAvoidingView
            style={styles.keyboard}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.hero}>
                <View pointerEvents="none" style={styles.heroDecoration}>
                  <View style={styles.heroRing} />
                  <View style={styles.heroRingInner} />
                </View>
                <View style={styles.brandRow}>
                  <View style={styles.brandIcon}>
                    <Text style={styles.brandIconText}>❋</Text>
                  </View>
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
                  Informe o endereço HTTPS, sem /api.
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
  loginContainer: { backgroundColor: '#103d2b' },
  keyboard: { flex: 1 },
  content: {
    flexGrow: 1,
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
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d8edb7',
  },
  brandIconText: { color: '#1b6741', fontSize: 28, lineHeight: 32 },
  brand: {
    color: '#fff',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandCaption: {
    color: '#b8d2bf',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  heroEyebrow: {
    color: '#c4e29a',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 34,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    maxWidth: 300,
    marginTop: 10,
    letterSpacing: -0.7,
  },
  heroDescription: {
    color: '#d5e6d9',
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 290,
    marginTop: 9,
  },
  heroAccent: {
    backgroundColor: '#b7db81',
    width: 44,
    height: 4,
    borderRadius: 4,
    marginTop: 18,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    marginHorizontal: 16,
    marginTop: -25,
    padding: 22,
    shadowColor: '#173e2b',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  welcomeCopy: { flex: 1 },
  welcomeIcon: {
    color: '#669b4e',
    backgroundColor: '#eff6e8',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 20,
    overflow: 'hidden',
  },
  formEyebrow: {
    color: '#648064',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  formTitle: {
    color: '#173e2b',
    fontSize: 25,
    fontWeight: '800',
    marginTop: 7,
    letterSpacing: -0.5,
  },
  formDescription: {
    color: '#65796c',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  fieldLabel: {
    color: '#284c38',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 19,
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d9e5da',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 50,
    color: '#183328',
    backgroundColor: '#f8faf7',
  },
  fieldHint: { color: '#75877b', fontSize: 12, lineHeight: 17, marginTop: 6 },
  devOption: {
    backgroundColor: '#f5f8f1',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  devRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  checkbox: {
    width: 20,
    height: 20,
    textAlign: 'center',
    lineHeight: 18,
    borderWidth: 1,
    borderColor: '#789781',
    borderRadius: 5,
    color: '#fff',
    fontWeight: '800',
    overflow: 'hidden',
  },
  checkboxChecked: { backgroundColor: '#197747', borderColor: '#197747' },
  devLabel: {
    color: '#385a44',
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
    fontWeight: '600',
  },
  devWarning: { color: '#9a551e', fontSize: 12, lineHeight: 18, marginTop: 9 },
  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d9e5da',
    borderRadius: 12,
    backgroundColor: '#f8faf7',
    minHeight: 50,
  },
  passwordInput: {
    flex: 1,
    color: '#183328',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  passwordToggle: { paddingHorizontal: 14, paddingVertical: 14 },
  passwordToggleText: { color: '#197747', fontSize: 12, fontWeight: '700' },
  button: {
    backgroundColor: '#197747',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    gap: 12,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  buttonArrow: { color: '#dcf1d0', fontSize: 20, lineHeight: 21 },
  sessionHint: {
    color: '#74877a',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 14,
  },
  statusCard: { marginHorizontal: 20, marginTop: 20, paddingHorizontal: 6 },
  statusHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  statusIcon: { color: '#8bb46c', fontSize: 10 },
  statusTitle: {
    color: '#66816c',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusText: { color: '#647a6a', fontSize: 12, lineHeight: 18, marginTop: 2 },
  footer: {
    color: '#91a393',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    textAlign: 'center',
    marginTop: 24,
  },
  error: { color: '#b83232', marginTop: 12, lineHeight: 19 },
});
