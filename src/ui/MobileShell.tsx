import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Connectivity } from '../app/sync/connectivity';
import { readSyncSummary, type SyncSummary } from '../app/sync/readSyncSummary';
import { SyncService } from '../app/sync/SyncService';
import {
  BackendClient,
  BackendError,
  type Usuario,
} from '../infra/api/BackendClient';
import { BackendSyncTransport } from '../infra/api/BackendSyncTransport';
import type { LocalDb } from '../infra/db/LocalDb';
import {
  OfflineRepository,
  type JsonObject,
  type LocalRecord,
} from '../infra/db/OfflineRepository';
import { CadastroRural } from './CadastroRural';
import {
  loadProperty,
  propertyFields,
  type PropertyDetail,
} from '../app/cadastros/editProperty';
import {
  loadPlot,
  plotFields,
  type PlotDetail,
} from '../app/cadastros/editPlot';

type Screen =
  | 'inicio'
  | 'atividades'
  | 'nova'
  | 'sync'
  | 'talhoes'
  | 'propriedades'
  | 'nova-propriedade'
  | 'editar-propriedade'
  | 'novo-talhao'
  | 'editar-talhao'
  | 'financeiro'
  | 'ia'
  | 'mapa'
  | 'mais';
type Talhao = {
  id_talhao: number;
  id_propriedade: number;
  nome_talhao: string;
  codigo_talhao: string;
  propriedade_nome: string;
  area_total: number | null;
  status_inicial: string | null;
};
type Propriedade = {
  id_propriedade: number;
  id_empresa: number | null;
  nome_propriedade: string;
  area_total: number | null;
  area_agricultavel: number | null;
  area_preservacao: number | null;
};
type Categoria = {
  id_categoria_atividade: number;
  nome: string;
  status: boolean;
};
type Tipo = {
  id_atividade: number;
  id_categoria_atividade: number;
  descricao: string;
  status: boolean;
};
type Atividade = {
  id_atividade_agricola: number;
  id_empresa: number | null;
  id_propriedade: number | null;
  tipo_atividade: string;
  nome_talhao: string;
  data_inicio: string;
  status: string;
  safra: string | null;
};
type Safra = {
  id_safra: number;
  id_propriedade: number;
  nome: string;
  cultura: string;
  area_plantada: number | null;
  status: boolean;
};
type Saldo = { receita_total: number; despesa_total: number; saldo: number };
type Lancamento = {
  id_lancamento: string;
  tipo: 'RECEITA' | 'DESPESA';
  categoria: string;
  descricao: string | null;
  valor: number;
  data_lancamento: string | null;
};
type Funcionario = {
  id_funcionario: string;
  nome_completo: string;
  status: boolean;
};
type QueueEntry = {
  sequence: number;
  entity_type: string;
  status: string;
  last_error: string | null;
  created_at: string;
};
type Message = { role: 'user' | 'assistant'; text: string };

const EMPTY_SUMMARY: SyncSummary = { pending: 0, syncing: 0, errors: 0 };
const statusNames: Record<string, string> = {
  pending: 'Pendente',
  syncing: 'Em envio',
  error: 'Com erro',
  synced: 'Enviado',
};
const titles: Record<Screen, string> = {
  inicio: 'Início',
  atividades: 'Atividades',
  nova: 'Nova atividade',
  sync: 'Sincronização',
  talhoes: 'Talhões',
  propriedades: 'Propriedades',
  'nova-propriedade': 'Nova propriedade',
  'editar-propriedade': 'Editar propriedade',
  'novo-talhao': 'Novo talhão',
  'editar-talhao': 'Editar talhão',
  financeiro: 'Custos da safra',
  ia: 'SafraIA',
  mapa: 'Mapa offline',
  mais: 'Mais',
};

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function money(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Action({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#91a198"
        multiline={multiline}
        maxLength={maxLength}
      />
    </View>
  );
}

function EditPlot({
  id,
  client,
  user,
  connectivity,
  properties,
  refresh,
  onClose,
  onSaved,
  busy,
  onBusyChange,
}: {
  id: number;
  client: BackendClient;
  user: Usuario;
  connectivity: Connectivity;
  properties: Propriedade[];
  refresh: () => Promise<boolean>;
  onClose: () => void;
  onSaved: (refreshed: boolean) => void;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [detail, setDetail] = useState<{
    plot: PlotDetail;
    property: PropertyDetail;
  } | null>(null);
  const detailRef = useRef(detail);
  detailRef.current = detail;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (detailRef.current) return;
    let active = true;
    setLoading(true);
    setError('');
    if (connectivity !== 'online') {
      setLoading(false);
      setError('É necessário estar online para carregar o talhão.');
    } else {
      loadPlot(client, user, id)
        .then(value => {
          if (active) setDetail(value);
        })
        .catch(() => {
          if (active)
            setError(
              'Não foi possível carregar o talhão. Confira a conexão e se sua propriedade pertence à sua empresa.',
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [attempt, client, connectivity, id, user]);
  useEffect(() => {
    if (detail) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [detail, onClose]);
  if (loading) return <Text style={styles.muted}>Carregando talhão...</Text>;
  if (error || !detail)
    return (
      <View>
        <Text accessibilityLiveRegion="polite" style={styles.warning}>
          {error}
        </Text>
        <Action
          label="Tentar carregar novamente"
          onPress={() => setAttempt(value => value + 1)}
        />
        <Action label="‹ Voltar para lista" onPress={onClose} />
      </View>
    );
  return (
    <CadastroRural
      kind="talhao"
      visible
      client={client}
      user={user}
      connectivity={connectivity}
      properties={properties}
      refresh={refresh}
      onClose={onClose}
      busy={busy}
      onBusyChange={onBusyChange}
      edit={{
        id,
        initial: plotFields(detail.plot),
        property: detail.property,
        onSaved,
      }}
    />
  );
}

function EditProperty({
  id,
  client,
  user,
  connectivity,
  properties,
  refresh,
  onClose,
  onSaved,
  busy,
  onBusyChange,
}: {
  id: number;
  client: BackendClient;
  user: Usuario;
  connectivity: Connectivity;
  properties: Propriedade[];
  refresh: () => Promise<boolean>;
  onClose: () => void;
  onSaved: (refreshed: boolean) => void;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [detail, setDetail] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    if (connectivity !== 'online') {
      setLoading(false);
      setError('É necessário estar online para carregar a propriedade.');
      return () => {
        active = false;
      };
    }
    loadProperty(client, user, id)
      .then(property => {
        if (active) setDetail(property);
      })
      .catch(() => {
        if (active)
          setError(
            'Não foi possível carregar a propriedade. Confira a conexão e se ela pertence à sua empresa.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, client, connectivity, id, user]);
  useEffect(() => {
    if (detail) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [detail, onClose]);
  if (loading)
    return <Text style={styles.muted}>Carregando propriedade...</Text>;
  if (error || !detail)
    return (
      <View>
        <Text accessibilityLiveRegion="polite" style={styles.warning}>
          {error}
        </Text>
        <Action
          label="Tentar carregar novamente"
          onPress={() => setAttempt(value => value + 1)}
        />
        <Action label="Voltar para lista" onPress={onClose} />
      </View>
    );
  return (
    <CadastroRural
      kind="propriedade"
      visible
      client={client}
      user={user}
      connectivity={connectivity}
      properties={properties}
      refresh={refresh}
      onClose={onClose}
      busy={busy}
      onBusyChange={onBusyChange}
      edit={{ id, initial: propertyFields(detail), onSaved }}
    />
  );
}

export function MobileShell({
  db,
  client,
  user,
  connectivity,
  onLogout,
}: {
  db: LocalDb;
  client: BackendClient;
  user: Usuario;
  connectivity: Connectivity;
  onLogout: () => void;
}) {
  const [screen, setScreen] = useState<Screen>('inicio');
  const [editingPropertyId, setEditingPropertyId] = useState<number | null>(
    null,
  );
  const [propertyRefreshFailed, setPropertyRefreshFailed] = useState(false);
  const [editingPlotId, setEditingPlotId] = useState<number | null>(null);
  const [plotRefreshFailed, setPlotRefreshFailed] = useState(false);
  const [properties, setProperties] = useState<Propriedade[]>([]);
  const [plots, setPlots] = useState<Talhao[]>([]);
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [types, setTypes] = useState<Tipo[]>([]);
  const [harvests, setHarvests] = useState<Safra[]>([]);
  const [activities, setActivities] = useState<Atividade[]>([]);
  const [localActivities, setLocalActivities] = useState<LocalRecord[]>([]);
  const [balance, setBalance] = useState<Saldo | null>(null);
  const [entries, setEntries] = useState<Lancamento[]>([]);
  const [employees, setEmployees] = useState<Record<number, Funcionario[]>>({});
  const [summary, setSummary] = useState<SyncSummary>(EMPTY_SUMMARY);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loadError, setLoadError] = useState('');
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const [syncing, setSyncing] = useState(false);
  const syncLock = useRef(false);
  const [category, setCategory] = useState<number | null>(null);
  const [type, setType] = useState<number | null>(null);
  const [plot, setPlot] = useState<number | null>(null);
  const [responsible, setResponsible] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [harvest, setHarvest] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [cadastroBusy, setCadastroBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [asking, setAsking] = useState(false);
  const canViewFinance = [
    'administrador',
    'financeiro',
    'proprietario',
  ].includes(user.perfil.toLowerCase());

  const reloadLocal = useCallback(async () => {
    const [nextSummary, nextQueue, local] = await Promise.all([
      readSyncSummary(db),
      db.query<QueueEntry>(
        'SELECT sequence, entity_type, status, last_error, created_at FROM sync_queue ORDER BY sequence DESC',
      ),
      new OfflineRepository(db).list('atividade_agricola'),
    ]);
    setSummary(nextSummary);
    setQueue(nextQueue);
    setLocalActivities(local);
  }, [db]);

  const reloadRemote = useCallback(async () => {
    if (connectivity !== 'online') {
      return;
    }
    try {
      await client.verifySession(user);
      const [
        allProperties,
        allPlots,
        allActivities,
        allCategories,
        allTypes,
        allHarvests,
      ] = await Promise.all([
        client.request<Propriedade[]>('/propriedades'),
        client.request<Talhao[]>('/talhoes'),
        client.request<Atividade[]>('/atividades'),
        client.request<Categoria[]>('/categorias-atividade'),
        client.request<Tipo[]>('/tipos-atividade'),
        client.request<Safra[]>('/safras'),
      ]);
      const owned = allProperties.filter(
        item => user.id_empresa !== null && item.id_empresa === user.id_empresa,
      );
      const propertyIds = new Set(owned.map(item => item.id_propriedade));
      setProperties(owned);
      setPlots(allPlots.filter(item => propertyIds.has(item.id_propriedade)));
      setActivities(
        allActivities.filter(
          item =>
            item.id_empresa === user.id_empresa &&
            user.id_empresa !== null &&
            item.id_propriedade !== null &&
            propertyIds.has(item.id_propriedade),
        ),
      );
      setCategories(allCategories.filter(item => item.status));
      setTypes(allTypes.filter(item => item.status));
      setHarvests(
        allHarvests.filter(item => propertyIds.has(item.id_propriedade)),
      );
      setRemoteLoaded(true);
      setLoadError('');
      if (canViewFinance) {
        const [totals, propertyEntries] = await Promise.all([
          Promise.all(
            owned.map(item =>
              client.request<Saldo>(
                `/financeiro/saldo?id_propriedade=${item.id_propriedade}`,
              ),
            ),
          ),
          Promise.all(
            owned.map(item =>
              client.request<Lancamento[]>(
                `/lancamentos?id_propriedade=${item.id_propriedade}`,
              ),
            ),
          ),
        ]);
        setBalance(
          totals.reduce(
            (total, item) => ({
              receita_total: total.receita_total + item.receita_total,
              despesa_total: total.despesa_total + item.despesa_total,
              saldo: total.saldo + item.saldo,
            }),
            { receita_total: 0, despesa_total: 0, saldo: 0 },
          ),
        );
        setEntries(
          propertyEntries
            .flat()
            .sort((first, second) =>
              (second.data_lancamento ?? '').localeCompare(
                first.data_lancamento ?? '',
              ),
            ),
        );
      }
    } catch (error) {
      setLoadError(
        error instanceof BackendError && error.status === 401
          ? 'Sessão expirada. Entre novamente para atualizar os dados.'
          : 'Não foi possível atualizar os dados do servidor. Confira a conexão e tente novamente.',
      );
    }
  }, [canViewFinance, client, connectivity, user]);

  const refreshCadastros = useCallback(async (): Promise<boolean> => {
    if (connectivity !== 'online') {
      return false;
    }
    try {
      await client.verifySession(user);
      const [allProperties, allPlots] = await Promise.all([
        client.request<Propriedade[]>('/propriedades'),
        client.request<Talhao[]>('/talhoes'),
      ]);
      const owned = allProperties.filter(
        item => user.id_empresa !== null && item.id_empresa === user.id_empresa,
      );
      const propertyIds = new Set(owned.map(item => item.id_propriedade));
      setProperties(owned);
      setPlots(allPlots.filter(item => propertyIds.has(item.id_propriedade)));
      setRemoteLoaded(true);
      return true;
    } catch {
      return false;
    }
  }, [client, connectivity, user]);

  const sync = useCallback(async () => {
    if (connectivity !== 'online' || syncLock.current) {
      return;
    }
    syncLock.current = true;
    setSyncing(true);
    try {
      await client.verifySession(user);
      const result = await new SyncService(
        db,
        new BackendSyncTransport(client),
      ).processQueue();
      setNotice(
        result === 'blocked'
          ? 'Há um envio bloqueado. Confira o erro antes de qualquer reenvio.'
          : result === 'empty'
          ? 'Fila atualizada.'
          : 'A fila aguarda nova verificação.',
      );
      await reloadLocal();
      await reloadRemote();
    } catch (error) {
      setNotice(
        error instanceof BackendError && error.status === 401
          ? 'Sessão expirada. Entre novamente para sincronizar.'
          : 'Não foi possível atualizar a fila. Confira o estado antes de tentar novamente.',
      );
    } finally {
      syncLock.current = false;
      setSyncing(false);
    }
  }, [client, connectivity, db, reloadLocal, reloadRemote, user]);

  useEffect(() => {
    reloadLocal().catch(() =>
      setLoadError('Não foi possível consultar os dados locais.'),
    );
  }, [reloadLocal]);
  useEffect(() => {
    if (connectivity === 'online') {
      sync();
    }
  }, [connectivity, sync]);

  const selectedProperty = plots.find(
    item => item.id_talhao === plot,
  )?.id_propriedade;
  useEffect(() => {
    let active = true;
    if (
      selectedProperty &&
      connectivity === 'online' &&
      !employees[selectedProperty]
    ) {
      client
        .verifySession(user)
        .then(() =>
          client.request<Funcionario[]>(
            `/funcionarios?id_propriedade=${selectedProperty}&status=ativo`,
          ),
        )
        .then(result => {
          if (active) {
            setEmployees(current => ({
              ...current,
              [selectedProperty]: result.map(item => ({
                id_funcionario: item.id_funcionario,
                nome_completo: item.nome_completo,
                status: item.status,
              })),
            }));
          }
        })
        .catch(() => {
          if (active) {
            setNotice(
              'Não foi possível carregar os responsáveis desta propriedade.',
            );
          }
        });
    }
    return () => {
      active = false;
    };
  }, [client, connectivity, employees, selectedProperty, user]);

  async function saveActivity() {
    if (saving) {
      return;
    }
    const selectedType = types.find(
      item =>
        item.id_atividade === type && item.id_categoria_atividade === category,
    );
    const selectedPlot = plots.find(item => item.id_talhao === plot);
    const numberCost = cost.trim() ? Number(cost.replace(',', '.')) : null;
    if (
      !selectedType ||
      !selectedPlot ||
      !validDate(date) ||
      (numberCost !== null &&
        (!Number.isFinite(numberCost) || numberCost < 0)) ||
      user.id_empresa === null
    ) {
      setNotice(
        'Selecione categoria, tipo e talhão; informe uma data válida e um custo não negativo.',
      );
      return;
    }
    setSaving(true);
    try {
      const ids = await db.query<{ id: string }>(
        'SELECT lower(hex(randomblob(16))) AS id',
      );
      const eventIds = await db.query<{ id: string }>(
        'SELECT lower(hex(randomblob(16))) AS id',
      );
      const payload: JsonObject = {
        id_categoria_atividade: category,
        id_tipo_atividade: type,
        id_talhao: plot,
        id_propriedade: selectedPlot.id_propriedade,
        id_empresa: user.id_empresa,
        id_funcionario: responsible,
        data_inicio: date,
        status: 'Planejada',
        safra: harvest.trim() || null,
        custo_operacao: numberCost,
        observacoes: notes.trim() || null,
      };
      const data: JsonObject = {
        ...payload,
        tipo_atividade: selectedType.descricao,
        nome_talhao: selectedPlot.nome_talhao,
      };
      await new OfflineRepository(db).create({
        entityType: 'atividade_agricola',
        localId: ids[0].id,
        eventId: eventIds[0].id,
        deviceId: 'local',
        timestamp: new Date().toISOString(),
        data,
        eventPayload: payload,
      });
      await reloadLocal();
      setNotice('Atividade salva no aparelho e adicionada à fila.');
      setScreen('atividades');
      setNotes('');
      setCost('');
      if (connectivity === 'online') {
        sync();
      }
    } catch {
      setNotice('Não foi possível salvar a atividade no aparelho.');
    } finally {
      setSaving(false);
    }
  }

  async function ask() {
    const text = question.trim();
    if (!text || asking || connectivity !== 'online') {
      return;
    }
    setQuestion('');
    setMessages(current => [...current, { role: 'user', text }]);
    setAsking(true);
    try {
      const result = await client.request<{ texto: string }>(
        '/safra-ia/consultar',
        'POST',
        { pergunta: text },
      );
      setMessages(current => [
        ...current,
        { role: 'assistant', text: result.texto },
      ]);
    } catch {
      setMessages(current => [
        ...current,
        {
          role: 'assistant',
          text: 'Não foi possível consultar a SafraIA. Tente novamente quando houver conexão.',
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  const connection =
    connectivity === 'online'
      ? 'Online'
      : connectivity === 'offline'
      ? 'Offline · modo campo'
      : 'Conexão desconhecida';
  const queued = summary.pending + summary.syncing + summary.errors;
  const selectedHarvest = harvests.find(item => item.status) ?? harvests[0];
  const filteredActivities = activities.filter(item =>
    `${item.tipo_atividade} ${item.nome_talhao} ${item.status}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  const locallyVisible = localActivities.filter(
    item =>
      item.sync_status !== 'synced' &&
      item.data_json.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <View style={styles.screen}>
      {screen === 'inicio' || screen === 'ia' ? (
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>
            {screen === 'ia'
              ? 'ASSISTENTE DE CAMPO'
              : `OLÁ, ${user.nome.toUpperCase()}`}
          </Text>
          <Text style={styles.heroTitle}>
            {screen === 'ia' ? '✦  SafraIA' : 'SafraViva'}
          </Text>
          <Text style={styles.heroText}>
            {connection} · {queued} na fila
          </Text>
        </View>
      ) : (
        <View style={styles.header}>
          {screen !== 'editar-propriedade' && screen !== 'editar-talhao' && (
            <Pressable
              accessibilityLabel="Voltar ao início"
              onPress={() => setScreen('inicio')}
            >
              <Text style={styles.back}>‹</Text>
            </Pressable>
          )}
          <View style={styles.headerTitle}>
            <Text style={styles.eyebrow}>SAFRAVIVA · CAMPO</Text>
            <Text style={styles.title}>{titles[screen]}</Text>
          </View>
          <Text style={styles.connection}>{connection}</Text>
        </View>
      )}
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {!!loadError && <Text style={styles.warning}>{loadError}</Text>}
        {!!notice && <Text style={styles.info}>{notice}</Text>}
        {screen === 'inicio' && (
          <>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>SAFRA ATUAL</Text>
              <Text style={styles.cardTitle}>
                {selectedHarvest?.nome ??
                  (remoteLoaded
                    ? 'Nenhuma safra cadastrada'
                    : 'Dados indisponíveis')}
              </Text>
              <Text style={styles.muted}>
                {selectedHarvest
                  ? `${selectedHarvest.cultura} · ${
                      selectedHarvest.area_plantada ?? 0
                    } ha plantados`
                  : remoteLoaded
                  ? 'Cadastre uma safra no sistema para acompanhar aqui.'
                  : 'Conecte-se para carregar os dados da safra.'}
              </Text>
            </View>
            <View style={styles.grid}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir lista de propriedades"
                accessibilityValue={{
                  text: remoteLoaded
                    ? `${properties.length} ${
                        properties.length === 1
                          ? 'propriedade cadastrada'
                          : 'propriedades cadastradas'
                      }`
                    : 'Quantidade de propriedades indisponível',
                }}
                onPress={() => setScreen('propriedades')}
                style={styles.metric}
              >
                <Text style={styles.metricIcon}>❋</Text>
                <Text style={styles.label}>PROPRIEDADES</Text>
                <Text style={styles.metricNumber}>
                  {remoteLoaded ? properties.length : '—'}
                </Text>
                <Text style={styles.muted}>cadastradas</Text>
                <Text style={styles.badge}>Ver lista ›</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir lista de talhões"
                accessibilityValue={{
                  text: remoteLoaded
                    ? `${plots.length} ${
                        plots.length === 1
                          ? 'talhão cadastrado'
                          : 'talhões cadastrados'
                      }`
                    : 'Quantidade de talhões indisponível',
                }}
                onPress={() => setScreen('talhoes')}
                style={styles.metric}
              >
                <Text style={styles.metricIcon}>♧</Text>
                <Text style={styles.label}>TALHÕES</Text>
                <Text style={styles.metricNumber}>
                  {remoteLoaded ? plots.length : '—'}
                </Text>
                <Text style={styles.muted}>áreas produtivas</Text>
                <Text style={styles.badge}>Ver lista ›</Text>
              </Pressable>
              <View style={styles.metric}>
                <Text style={styles.metricIcon}>⌁</Text>
                <Text style={styles.label}>ÁREA CULTIVADA</Text>
                <Text style={styles.metricNumber}>
                  {selectedHarvest?.area_plantada ?? '—'} ha
                </Text>
                <Text style={styles.muted}>safra selecionada</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricIcon}>↻</Text>
                <Text style={styles.label}>FILA LOCAL</Text>
                <Text style={styles.metricNumber}>{queued}</Text>
                <Text style={styles.muted}>a acompanhar</Text>
              </View>
            </View>
            <Text style={styles.section}>Atalhos rápidos</Text>
            <View style={styles.chips}>
              {(
                [
                  ['Nova atividade', 'nova'],
                  ['Talhões', 'talhoes'],
                  ['Financeiro', 'financeiro'],
                  ['Sincronização', 'sync'],
                ] as [string, Screen][]
              ).map(([label, target]) => (
                <Chip
                  key={target}
                  label={label}
                  onPress={() => setScreen(target)}
                />
              ))}
            </View>
            <Text style={styles.section}>Atividades recentes</Text>
            {filteredActivities.slice(0, 3).map(item => (
              <View style={styles.card} key={item.id_atividade_agricola}>
                <Text style={styles.cardTitle}>{item.tipo_atividade}</Text>
                <Text style={styles.muted}>
                  {item.nome_talhao} · {item.data_inicio}
                </Text>
              </View>
            ))}
            <Chip
              label="Ver atividades ›"
              onPress={() => setScreen('atividades')}
            />
          </>
        )}
        {screen === 'atividades' && (
          <>
            <View style={styles.row}>
              <Text style={styles.section}>Registros do campo</Text>
              <Chip
                label="+ Nova atividade"
                onPress={() => {
                  setNotice('');
                  setScreen('nova');
                }}
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Buscar por atividade, talhão ou status"
              value={filter}
              onChangeText={setFilter}
            />
            {locallyVisible.map(item => {
              const data = JSON.parse(item.data_json);
              return (
                <View style={styles.card} key={item.local_id}>
                  <Text style={styles.cardTitle}>{data.tipo_atividade}</Text>
                  <Text style={styles.muted}>
                    {data.nome_talhao} · {data.data_inicio}
                  </Text>
                  <Text style={styles.badge}>
                    {statusNames[item.sync_status]}
                  </Text>
                </View>
              );
            })}
            {filteredActivities.map(item => (
              <View style={styles.card} key={item.id_atividade_agricola}>
                <Text style={styles.cardTitle}>{item.tipo_atividade}</Text>
                <Text style={styles.muted}>
                  {item.nome_talhao} · {item.data_inicio}
                </Text>
                <Text style={styles.badge}>{item.status}</Text>
              </View>
            ))}
            {locallyVisible.length === 0 && filteredActivities.length === 0 && (
              <Text style={styles.muted}>
                {remoteLoaded
                  ? 'Nenhuma atividade encontrada.'
                  : 'Atividades do servidor indisponíveis.'}
              </Text>
            )}
          </>
        )}
        {screen === 'nova' && (
          <>
            <Text style={styles.info}>
              A atividade é salva no aparelho antes do envio. É necessário
              carregar os cadastros enquanto estiver online.
            </Text>
            <Text style={styles.section}>Categoria</Text>
            <View style={styles.chips}>
              {categories.map(item => (
                <Chip
                  key={item.id_categoria_atividade}
                  label={item.nome}
                  selected={category === item.id_categoria_atividade}
                  onPress={() => {
                    setCategory(item.id_categoria_atividade);
                    setType(null);
                  }}
                />
              ))}
            </View>
            <Text style={styles.section}>Tipo de atividade</Text>
            <View style={styles.chips}>
              {types
                .filter(item => item.id_categoria_atividade === category)
                .map(item => (
                  <Chip
                    key={item.id_atividade}
                    label={item.descricao}
                    selected={type === item.id_atividade}
                    onPress={() => setType(item.id_atividade)}
                  />
                ))}
            </View>
            <Text style={styles.section}>Talhão</Text>
            <View style={styles.chips}>
              {plots.map(item => (
                <Chip
                  key={item.id_talhao}
                  label={`${item.codigo_talhao} · ${item.nome_talhao}`}
                  selected={plot === item.id_talhao}
                  onPress={() => {
                    setPlot(item.id_talhao);
                    setResponsible(null);
                  }}
                />
              ))}
            </View>
            <Text style={styles.section}>Responsável · opcional</Text>
            <View style={styles.chips}>
              {selectedProperty &&
                (employees[selectedProperty] ?? []).map(item => (
                  <Chip
                    key={item.id_funcionario}
                    label={item.nome_completo}
                    selected={responsible === item.id_funcionario}
                    onPress={() =>
                      setResponsible(
                        responsible === item.id_funcionario
                          ? null
                          : item.id_funcionario,
                      )
                    }
                  />
                ))}
            </View>
            <Field
              label="SAFRA"
              value={harvest}
              onChangeText={setHarvest}
              maxLength={20}
              placeholder="Ex.: Soja 2026/27"
            />
            <Field
              label="DATA · AAAA-MM-DD"
              value={date}
              onChangeText={setDate}
            />
            <Field
              label="CUSTO OPERACIONAL · R$"
              value={cost}
              onChangeText={setCost}
              placeholder="0,00"
            />
            <Field
              label="OBSERVAÇÕES"
              value={notes}
              onChangeText={setNotes}
              maxLength={1000}
              placeholder="Condições de campo..."
              multiline
            />
            <Action
              label={saving ? 'Salvando...' : 'Salvar atividade'}
              onPress={saveActivity}
              disabled={saving}
            />
          </>
        )}
        {screen === 'sync' && (
          <>
            <View style={styles.darkCard}>
              <Text style={styles.heroEyebrow}>STATUS DA CONEXÃO</Text>
              <Text style={styles.heroTitle}>{connection}</Text>
              <Text style={styles.heroText}>
                {summary.pending} pendentes · {summary.errors} com erro
              </Text>
              <Action
                label={syncing ? 'Sincronizando...' : 'Sincronizar agora'}
                disabled={syncing || connectivity !== 'online'}
                onPress={sync}
              />
            </View>
            <Text style={styles.section}>Fila do dispositivo</Text>
            {queue.map(item => (
              <View style={styles.card} key={item.sequence}>
                <Text style={styles.cardTitle}>
                  {item.entity_type === 'atividade_agricola'
                    ? 'Atividade agrícola'
                    : 'Movimentação de estoque'}
                </Text>
                <Text style={styles.muted}>
                  {item.created_at} · {statusNames[item.status]}
                </Text>
                {!!item.last_error && (
                  <Text style={styles.warning}>{item.last_error}</Text>
                )}
              </View>
            ))}
            {queue.length === 0 && (
              <Text style={styles.muted}>Nenhum evento na fila.</Text>
            )}
            <Text style={styles.info}>
              Envios com resultado desconhecido ficam bloqueados para evitar
              duplicações. Confira no servidor antes de qualquer correção.
            </Text>
          </>
        )}
        {screen === 'talhoes' && (
          <>
            {plotRefreshFailed && (
              <Action
                label="Atualizar lista de talhões"
                onPress={() => {
                  refreshCadastros().then(refreshed => {
                    setPlotRefreshFailed(!refreshed);
                    setNotice(
                      refreshed
                        ? 'Lista de talhões atualizada.'
                        : 'Não foi possível atualizar a lista. Tente novamente.',
                    );
                  });
                }}
              />
            )}
            <Action
              label="+ Novo talhão"
              onPress={() => setScreen('novo-talhao')}
            />
            <View style={styles.card}>
              <Text style={styles.label}>ÁREA TOTAL</Text>
              <Text style={styles.metricNumber}>
                {remoteLoaded
                  ? plots
                      .reduce(
                        (total, item) => total + (item.area_total ?? 0),
                        0,
                      )
                      .toFixed(1)
                  : '—'}{' '}
                ha
              </Text>
            </View>
            <Text style={styles.section}>Áreas produtivas</Text>
            {plots.map(item => (
              <Pressable
                style={styles.card}
                key={item.id_talhao}
                accessibilityRole="button"
                accessibilityLabel={`Editar talhão ${item.nome_talhao}`}
                onPress={() => {
                  setNotice('');
                  setEditingPlotId(item.id_talhao);
                  setScreen('editar-talhao');
                }}
              >
                <Text style={styles.cardTitle}>{item.nome_talhao}</Text>
                <Text style={styles.muted}>
                  {item.propriedade_nome} · {item.codigo_talhao}
                </Text>
                <Text style={styles.badge}>
                  {item.area_total ?? '—'} ha ·{' '}
                  {item.status_inicial ?? 'Sem status'}
                </Text>
                <Text style={styles.muted}>✎ Editar talhão ›</Text>
              </Pressable>
            ))}
            {plots.length === 0 && (
              <Text style={styles.muted}>
                {remoteLoaded
                  ? 'Nenhum talhão disponível.'
                  : 'Talhões do servidor indisponíveis.'}
              </Text>
            )}
          </>
        )}
        {screen === 'propriedades' && (
          <>
            {propertyRefreshFailed && (
              <Action
                label="Atualizar lista de propriedades"
                onPress={() => {
                  refreshCadastros().then(refreshed => {
                    setPropertyRefreshFailed(!refreshed);
                    setNotice(
                      refreshed
                        ? 'Lista de propriedades atualizada.'
                        : 'Não foi possível atualizar a lista. Tente novamente.',
                    );
                  });
                }}
              />
            )}
            <Action
              label="+ Nova propriedade"
              onPress={() => setScreen('nova-propriedade')}
            />
            <Text style={styles.section}>Fazendas cadastradas</Text>
            {properties.map(item => (
              <Pressable
                style={styles.card}
                key={item.id_propriedade}
                accessibilityRole="button"
                accessibilityLabel={`Editar propriedade ${item.nome_propriedade}`}
                onPress={() => {
                  setNotice('');
                  setEditingPropertyId(item.id_propriedade);
                  setScreen('editar-propriedade');
                }}
              >
                <Text style={styles.cardTitle}>{item.nome_propriedade}</Text>
                <Text style={styles.muted}>
                  Área total: {item.area_total ?? '—'} ha
                </Text>
                <Text style={styles.badge}>
                  Agricultável: {item.area_agricultavel ?? '—'} ha ·
                  Preservação: {item.area_preservacao ?? '—'} ha
                </Text>
                <Text style={styles.muted}>✎ Editar propriedade ›</Text>
              </Pressable>
            ))}
            {properties.length === 0 && (
              <Text style={styles.muted}>
                {remoteLoaded
                  ? 'Nenhuma propriedade disponível para esta empresa.'
                  : 'Propriedades do servidor indisponíveis.'}
              </Text>
            )}
          </>
        )}
        {screen === 'financeiro' &&
          (canViewFinance ? (
            <>
              <View style={styles.card}>
                <Text style={styles.label}>RESULTADO DAS PROPRIEDADES</Text>
                <Text style={styles.metricNumber}>
                  {balance ? money(balance.saldo) : '—'}
                </Text>
                <Text style={styles.muted}>
                  Receitas: {balance ? money(balance.receita_total) : '—'}
                </Text>
                <Text style={styles.muted}>
                  Despesas: {balance ? money(balance.despesa_total) : '—'}
                </Text>
              </View>
              <Text style={styles.info}>
                Valores acumulados retornados pelo backend para as propriedades
                da empresa.
              </Text>
              <Text style={styles.section}>Lançamentos recentes</Text>
              {entries.slice(0, 5).map(item => (
                <View style={styles.card} key={item.id_lancamento}>
                  <Text style={styles.cardTitle}>
                    {item.descricao || item.categoria}
                  </Text>
                  <Text style={styles.muted}>
                    {item.categoria} · {item.data_lancamento ?? 'Sem data'}
                  </Text>
                  <Text style={styles.badge}>
                    {item.tipo === 'DESPESA' ? '−' : '+'}
                    {money(item.valor)}
                  </Text>
                </View>
              ))}
              {entries.length === 0 && (
                <Text style={styles.muted}>Nenhum lançamento disponível.</Text>
              )}
            </>
          ) : (
            <Text style={styles.warning}>
              Seu perfil não tem acesso aos dados financeiros.
            </Text>
          ))}
        {screen === 'ia' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Olá, {user.nome}!</Text>
              <Text style={styles.muted}>
                Posso ajudar com perguntas sobre sua operação. A consulta de
                texto requer internet.
              </Text>
            </View>
            {messages.map((message, index) => (
              <View
                style={[
                  styles.card,
                  message.role === 'user' && styles.userMessage,
                ]}
                key={index}
              >
                <Text style={styles.cardTitle}>
                  {message.role === 'user' ? 'Você' : 'SafraIA'}
                </Text>
                <Text style={styles.messageText}>{message.text}</Text>
              </View>
            ))}
            <Field
              label="SUA PERGUNTA"
              value={question}
              onChangeText={setQuestion}
              placeholder="Pergunte sobre sua safra..."
              multiline
            />
            <Action
              label={asking ? 'Consultando...' : 'Enviar pergunta'}
              onPress={ask}
              disabled={asking || connectivity !== 'online'}
            />
            <Text style={styles.muted}>
              Voz e modo mãos livres ainda não estão disponíveis.
            </Text>
          </>
        )}
        {screen === 'mapa' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Mapa offline ainda indisponível
              </Text>
              <Text style={styles.muted}>
                O backend consultado fornece coordenadas, mas este aplicativo
                ainda não baixa mapas ou polígonos para uso offline.
              </Text>
            </View>
            <Chip label="Ver talhões" onPress={() => setScreen('talhoes')} />
          </>
        )}
        {screen === 'mais' && (
          <>
            <View style={styles.darkCard}>
              <Text style={styles.heroTitle}>{user.nome}</Text>
              <Text style={styles.heroText}>
                {user.perfil} · {connection}
              </Text>
            </View>
            <Text style={styles.section}>Minha operação</Text>
            {(
              [
                ['Propriedades', 'propriedades'],
                ['Talhões', 'talhoes'],
                ['Financeiro e insumos', 'financeiro'],
                ['Central de sincronização', 'sync'],
                ['SafraIA', 'ia'],
                ['Mapa offline', 'mapa'],
              ] as [string, Screen][]
            ).map(([label, target]) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={label}
                key={target}
                onPress={() => setScreen(target)}
                style={styles.menuItem}
              >
                <Text style={styles.menuText}>{label}</Text>
                <Text style={styles.muted}>›</Text>
              </Pressable>
            ))}
            <Action
              label="Sair da conta"
              disabled={syncing || cadastroBusy}
              onPress={() => {
                if (!syncLock.current && !cadastroBusy) {
                  onLogout();
                }
              }}
            />
          </>
        )}
        <CadastroRural
          kind="propriedade"
          visible={screen === 'nova-propriedade'}
          client={client}
          user={user}
          connectivity={connectivity}
          properties={properties}
          refresh={refreshCadastros}
          onClose={() => setScreen('propriedades')}
          busy={cadastroBusy}
          onBusyChange={setCadastroBusy}
        />
        {screen === 'editar-propriedade' && editingPropertyId !== null && (
          <EditProperty
            key={editingPropertyId}
            id={editingPropertyId}
            client={client}
            user={user}
            connectivity={connectivity}
            properties={properties}
            refresh={refreshCadastros}
            busy={cadastroBusy}
            onBusyChange={setCadastroBusy}
            onClose={() => setScreen('propriedades')}
            onSaved={refreshed => {
              setPropertyRefreshFailed(!refreshed);
              setNotice(
                refreshed
                  ? 'Propriedade atualizada com sucesso.'
                  : 'Propriedade atualizada com sucesso, mas a lista não foi atualizada.',
              );
              setScreen('propriedades');
            }}
          />
        )}
        <CadastroRural
          kind="talhao"
          visible={screen === 'novo-talhao'}
          client={client}
          user={user}
          connectivity={connectivity}
          properties={properties}
          refresh={refreshCadastros}
          onClose={() => setScreen('talhoes')}
          busy={cadastroBusy}
          onBusyChange={setCadastroBusy}
        />
        {screen === 'editar-talhao' && editingPlotId !== null && (
          <EditPlot
            key={editingPlotId}
            id={editingPlotId}
            client={client}
            user={user}
            connectivity={connectivity}
            properties={properties}
            refresh={refreshCadastros}
            busy={cadastroBusy}
            onBusyChange={setCadastroBusy}
            onClose={() => setScreen('talhoes')}
            onSaved={refreshed => {
              setPlotRefreshFailed(!refreshed);
              setNotice(
                refreshed
                  ? 'Talhão atualizado com sucesso.'
                  : 'Talhão atualizado com sucesso, mas a lista não foi atualizada.',
              );
              setScreen('talhoes');
            }}
          />
        )}
        {syncing && <ActivityIndicator color="#187647" />}
      </ScrollView>
      {screen !== 'editar-propriedade' && screen !== 'editar-talhao' && (
        <View style={styles.nav}>
          {(
            [
              ['⌂', 'Início', 'inicio'],
              ['▤', 'Atividades', 'atividades'],
              ['✦', 'SafraIA', 'ia'],
              ['⌖', 'Mapa', 'mapa'],
              ['▦', 'Mais', 'mais'],
            ] as [string, string, Screen][]
          ).map(([icon, label, target]) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              key={target}
              onPress={() => {
                setNotice('');
                setScreen(target);
              }}
              style={styles.navItem}
            >
              <Text
                style={[
                  styles.navIcon,
                  screen === target && styles.navSelected,
                ]}
              >
                {icon}
              </Text>
              <Text
                style={[
                  styles.navText,
                  screen === target && styles.navSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f6f1' },
  hero: {
    backgroundColor: '#103d2b',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    padding: 22,
    minHeight: 128,
  },
  heroEyebrow: {
    color: '#b8d2c2',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTitle: { color: '#fff', fontSize: 23, fontWeight: '800', marginTop: 6 },
  heroText: { color: '#cde4d5', marginTop: 9, fontSize: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10,
  },
  back: { fontSize: 30, color: '#214f39', width: 30, textAlign: 'center' },
  headerTitle: { flex: 1 },
  eyebrow: {
    color: '#81958a',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: { color: '#143027', fontSize: 21, fontWeight: '800' },
  connection: {
    color: '#167746',
    fontSize: 10,
    fontWeight: '700',
    maxWidth: 105,
    textAlign: 'right',
  },
  body: { padding: 16, paddingBottom: 28, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e1ebe2',
    padding: 16,
  },
  darkCard: { backgroundColor: '#103d2b', borderRadius: 20, padding: 18 },
  cardTitle: { color: '#172e27', fontSize: 15, fontWeight: '800' },
  muted: { color: '#81938b', fontSize: 12, marginTop: 5, lineHeight: 18 },
  label: {
    color: '#81958a',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  metricNumber: {
    color: '#17382b',
    fontSize: 21,
    fontWeight: '800',
    marginTop: 5,
  },
  metricIcon: { color: '#1e8950', fontSize: 20, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e1ebe2',
    padding: 15,
    width: '48%',
    flexGrow: 1,
  },
  section: { color: '#183328', fontWeight: '800', fontSize: 15, marginTop: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d8e6db',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 14,
  },
  chipSelected: { backgroundColor: '#e4f6e9', borderColor: '#208249' },
  chipText: { color: '#476257', fontSize: 12, fontWeight: '700' },
  chipTextSelected: { color: '#168049' },
  badge: { color: '#19804a', fontSize: 11, fontWeight: '700', marginTop: 9 },
  field: { marginTop: 8, gap: 7 },
  input: {
    borderWidth: 1,
    borderColor: '#d8e6db',
    color: '#183328',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    minHeight: 46,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  button: {
    backgroundColor: '#197747',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: { color: '#fff', fontWeight: '800' },
  disabled: { opacity: 0.45 },
  warning: {
    color: '#a43936',
    backgroundColor: '#fff1ed',
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    lineHeight: 18,
  },
  info: {
    color: '#52786a',
    backgroundColor: '#e8f5eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    lineHeight: 18,
  },
  userMessage: { backgroundColor: '#e8f5eb' },
  messageText: { color: '#355348', lineHeight: 20, marginTop: 6 },
  menuItem: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1ebe2',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  menuText: { color: '#264c39', fontWeight: '700' },
  nav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0eae2',
    paddingVertical: 7,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon: { color: '#8a9e93', fontSize: 22, fontWeight: '700' },
  navText: { color: '#81938b', fontSize: 10, fontWeight: '700' },
  navSelected: { color: '#197747' },
});
