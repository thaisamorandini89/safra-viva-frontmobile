import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Connectivity } from '../app/sync/connectivity';
import { createCadastro } from '../app/cadastros/createCadastro';
import {
  buildPropertyUpdate,
  updateProperty,
  type PropertyDetail,
} from '../app/cadastros/editProperty';
import { buildPlotUpdate, updatePlot } from '../app/cadastros/editPlot';
import {
  CepError,
  lookupCep,
  normalizeCep,
  resolveCepLocation,
  type CepAddress,
  type GeoSuggestion,
} from '../app/cadastros/cep';
import {
  validateCadastro,
  type CadastroErrors,
  type CadastroFields,
  type CadastroKind,
  type PropertyOption,
} from '../app/cadastros/validation';
import type { BackendClient, Usuario } from '../infra/api/BackendClient';

type Option = { id: number; label: string };
type Catalog = { options: Option[]; loading: boolean; error: boolean };
type CepSuggestion = { address: CepAddress; geo: GeoSuggestion | null };
const EMPTY_CATALOG: Catalog = { options: [], loading: false, error: false };
const STATUS = [
  'Livre',
  'Planejado',
  'Preparado',
  'Plantado',
  'Em Desenvolvimento',
  'Colheita',
  'Finalizado',
];
const TOPOGRAPHY = [
  'Plana',
  'Suave Ondulada',
  'Ondulada',
  'Forte Ondulada',
  'Montanhosa',
];

export function CadastroRural({
  kind,
  visible,
  client,
  user,
  connectivity,
  properties,
  refresh,
  onClose,
  busy,
  onBusyChange,
  edit,
}: {
  kind: CadastroKind;
  visible: boolean;
  client: BackendClient;
  user: Usuario;
  connectivity: Connectivity;
  properties: PropertyOption[];
  refresh: () => Promise<boolean>;
  onClose: () => void;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  edit?: {
    id: number;
    initial: CadastroFields;
    onSaved: (refreshed: boolean) => void;
    property?: PropertyDetail;
  };
}) {
  const [fields, setFields] = useState<CadastroFields>(
    () => edit?.initial ?? {},
  );
  const [errors, setErrors] = useState<CadastroErrors>({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const lock = useRef(false);
  const [soil, setSoil] = useState<Catalog>(EMPTY_CATALOG);
  const [classes, setClasses] = useState<Catalog>(EMPTY_CATALOG);
  const [states, setStates] = useState<Catalog>(EMPTY_CATALOG);
  const [cities, setCities] = useState<Catalog>(EMPTY_CATALOG);
  const [stateId, setStateId] = useState<number | null>(
    () => Number(edit?.initial.id_estado) || null,
  );
  const [citySearch, setCitySearch] = useState('');
  const loaded = useRef(false);
  const cityRequest = useRef(0);
  const fieldsRef = useRef(fields);
  const visibleRef = useRef(visible);
  const cepRequest = useRef(0);
  const cepLock = useRef(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState('');
  const [cepSuggestion, setCepSuggestion] = useState<CepSuggestion | null>(
    null,
  );
  fieldsRef.current = fields;
  visibleRef.current = visible;

  const invalidateCep = useCallback(() => {
    cepRequest.current += 1;
    cepLock.current = false;
    setCepLoading(false);
    setCepMessage('');
    setCepSuggestion(null);
  }, []);

  useEffect(() => {
    if (!visible) invalidateCep();
  }, [visible, invalidateCep]);

  useEffect(
    () => () => {
      cepRequest.current += 1;
    },
    [],
  );

  const setField = (name: string, value: string) => {
    if (['cep', 'id_estado', 'id_cidade'].includes(name)) {
      invalidateCep();
    } else if (['logradouro', 'bairro'].includes(name)) {
      setCepSuggestion(null);
    }
    fieldsRef.current = { ...fieldsRef.current, [name]: value };
    setFields(fieldsRef.current);
    setErrors(previous => ({ ...previous, [name]: '' }));
  };
  const loadCatalog = useCallback(
    async (
      path: string,
      setter: (value: Catalog) => void,
      convert: (row: Record<string, unknown>) => Option,
    ) => {
      setter({ options: [], loading: true, error: false });
      try {
        const rows = await client.request<Record<string, unknown>[]>(path);
        if (!Array.isArray(rows)) {
          throw new Error('Catálogo inválido');
        }
        setter({
          options: rows
            .map(convert)
            .filter(
              option =>
                Number.isSafeInteger(option.id) &&
                option.id > 0 &&
                !!option.label,
            ),
          loading: false,
          error: false,
        });
      } catch {
        setter({ options: [], loading: false, error: true });
      }
    },
    [client],
  );
  const loadSoil = useCallback(
    () =>
      loadCatalog('/tipos-solo', setSoil, row => ({
        id: Number(row.id),
        label: String(row.descricao ?? ''),
      })),
    [loadCatalog],
  );
  const loadClasses = useCallback(
    () =>
      loadCatalog('/classes-uso', setClasses, row => ({
        id: Number(row.id_classe_capacidade_uso),
        label: `${row.sigla ?? ''} ${row.descricao ?? ''}`.trim(),
      })),
    [loadCatalog],
  );
  const loadStates = useCallback(
    () =>
      loadCatalog('/estados', setStates, row => ({
        id: Number(row.id),
        label: `${row.uf ?? ''} - ${row.nome ?? ''}`,
      })),
    [loadCatalog],
  );

  useEffect(() => {
    if (!visible || loaded.current || connectivity !== 'online') {
      return;
    }
    loaded.current = true;
    loadSoil();
    if (kind === 'propriedade') {
      loadClasses();
      loadStates();
    }
  }, [visible, connectivity, kind, loadSoil, loadClasses, loadStates]);

  const loadCities = useCallback(
    async (id: number) => {
      const requestId = ++cityRequest.current;
      setCities({ options: [], loading: true, error: false });
      try {
        const rows = await client.request<Record<string, unknown>[]>(
          `/estados/${id}/cidades`,
        );
        if (!Array.isArray(rows)) {
          throw new Error('Catálogo inválido');
        }
        if (requestId === cityRequest.current) {
          setCities({
            options: rows
              .map(row => ({
                id: Number(row.id),
                label: String(row.nome ?? ''),
              }))
              .filter(
                option =>
                  Number.isSafeInteger(option.id) &&
                  option.id > 0 &&
                  !!option.label,
              ),
            loading: false,
            error: false,
          });
        }
      } catch {
        if (requestId === cityRequest.current) {
          setCities({ options: [], loading: false, error: true });
        }
      }
    },
    [client],
  );

  useEffect(() => {
    const initialState = Number(edit?.initial.id_estado);
    if (initialState > 0) loadCities(initialState);
  }, [edit?.id, edit?.initial.id_estado, loadCities]);

  const closeForm = useCallback(() => {
    if (lock.current || busy) return;
    const dirty =
      edit &&
      Object.keys(edit.initial).some(
        name => (fieldsRef.current[name] ?? '') !== (edit.initial[name] ?? ''),
      );
    if (dirty) {
      Alert.alert(
        'Descartar alterações?',
        uncertain
          ? `O resultado não foi confirmado. Ao sair, confira ${
              kind === 'talhao' ? 'o talhão' : 'a propriedade'
            } no servidor antes de tentar novamente; os dados locais serão perdidos.`
          : 'As alterações não salvas serão perdidas.',
        [
          { text: 'Continuar editando', style: 'cancel' },
          { text: 'Descartar', style: 'destructive', onPress: onClose },
        ],
      );
    } else {
      onClose();
    }
  }, [busy, edit, kind, onClose, uncertain]);

  useEffect(() => {
    if (!visible || !edit) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        closeForm();
        return true;
      },
    );
    return () => subscription.remove();
  }, [visible, edit, closeForm]);

  function applyCepSuggestion(suggestion: CepSuggestion, replace: boolean) {
    const current = fieldsRef.current;
    const next = { ...current };
    let conflict = false;
    for (const name of ['logradouro', 'bairro'] as const) {
      const value = suggestion.address[name];
      if (!value) continue;
      if (!current[name]?.trim() || current[name] === value || replace) {
        next[name] = value;
      } else {
        conflict = true;
      }
    }
    const geo = suggestion.geo;
    if (geo?.stateId && geo.cityId) {
      const state = String(geo.stateId);
      const city = String(geo.cityId);
      const geoConflict =
        (!!current.id_estado && current.id_estado !== state) ||
        (!!current.id_cidade && current.id_cidade !== city);
      if (!geoConflict || replace) {
        next.id_estado = state;
        next.id_cidade = city;
        cityRequest.current += 1;
        setStates({ options: geo.states, loading: false, error: false });
        setStateId(geo.stateId);
        setCities({ options: geo.cities, loading: false, error: false });
        setCitySearch('');
      } else {
        conflict = true;
      }
    }
    fieldsRef.current = next;
    setFields(next);
    setErrors(previous => ({
      ...previous,
      ...(next.logradouro?.trim() ? { logradouro: '' } : {}),
      ...(next.bairro?.trim() ? { bairro: '' } : {}),
      ...(next.id_cidade ? { id_cidade: '' } : {}),
    }));
    return conflict;
  }

  async function searchCep() {
    if (cepLock.current) return;
    const cep = normalizeCep(fieldsRef.current.cep ?? '');
    if (!cep) {
      setCepMessage('Informe um CEP válido com 8 dígitos.');
      return;
    }
    const requestId = ++cepRequest.current;
    cepLock.current = true;
    setCepLoading(true);
    setCepMessage('');
    setCepSuggestion(null);
    const isCurrent = () =>
      requestId === cepRequest.current &&
      visibleRef.current &&
      normalizeCep(fieldsRef.current.cep ?? '') === cep;
    try {
      const address = await lookupCep(cep);
      if (!isCurrent()) return;
      let geo: GeoSuggestion | null = null;
      try {
        geo = await resolveCepLocation(client, address);
      } catch {
        geo = null;
      }
      if (!isCurrent()) return;
      const suggestion = { address, geo };
      const conflict = applyCepSuggestion(suggestion, false);
      setCepSuggestion(conflict ? suggestion : null);
      const locationMessage =
        !geo?.stateId || !geo.cityId
          ? 'Não foi possível identificar a cidade no servidor. Selecione estado e cidade manualmente.'
          : 'CEP consultado. Confira o endereço.';
      setCepMessage(
        conflict
          ? `${locationMessage} Há dados diferentes; confirme se deseja aplicar as sugestões.`
          : locationMessage,
      );
    } catch (error) {
      if (!isCurrent()) return;
      setCepMessage(
        error instanceof CepError && error.reason === 'not-found'
          ? 'CEP não encontrado. Confira o número ou preencha o endereço manualmente.'
          : 'Não foi possível consultar o CEP. Tente novamente ou preencha o endereço manualmente.',
      );
    } finally {
      if (requestId === cepRequest.current) {
        cepLock.current = false;
        setCepLoading(false);
      }
    }
  }

  async function submit() {
    if (lock.current || busy || uncertain) {
      return;
    }
    const result = edit
      ? kind === 'talhao' && edit.property
        ? buildPlotUpdate(fields, edit.initial, user.id_empresa, edit.property)
        : buildPropertyUpdate(fields, edit.initial, user.id_empresa)
      : validateCadastro(kind, fields, user.id_empresa, properties);
    if (
      edit &&
      'addressChanged' in result &&
      result.addressChanged &&
      !cities.options.some(option => option.id === Number(fields.id_cidade))
    ) {
      result.errors.id_cidade =
        'Selecione uma cidade disponível no estado escolhido.';
    }
    setErrors(result.errors);
    if (Object.keys(result.errors).length) {
      setMessage('Confira os campos indicados.');
      return;
    }
    if (edit && Object.keys(result.payload).length === 0) {
      setMessage('Nenhuma alteração para salvar.');
      return;
    }
    lock.current = true;
    onBusyChange(true);
    setSaving(true);
    setMessage('');
    try {
      if (edit) {
        const updated =
          kind === 'talhao' && edit.property
            ? await updatePlot(
                client,
                user,
                connectivity,
                edit.id,
                edit.property.id_propriedade,
                result.payload,
              )
            : await updateProperty(
                client,
                user,
                connectivity,
                edit.id,
                result.payload,
              );
        if (updated.status === 'uncertain') {
          setUncertain(true);
          setMessage(updated.message);
        } else if (updated.status === 'rejected') {
          setMessage(updated.message);
        } else {
          const refreshed = await refresh().catch(() => false);
          edit.onSaved(refreshed);
        }
        return;
      }
      const created = await createCadastro(
        client,
        user,
        connectivity,
        kind,
        result.payload as Record<string, string | number>,
      );
      if (created.status === 'uncertain') {
        setUncertain(true);
        setReviewed(false);
        setMessage(created.message);
      } else if (created.status === 'rejected') {
        setMessage(created.message);
      } else {
        invalidateCep();
        cityRequest.current += 1;
        fieldsRef.current = {};
        setFields({});
        setStateId(null);
        setCitySearch('');
        const refreshed = await refresh().catch(() => false);
        setMessage(
          refreshed
            ? `Cadastro realizado com sucesso (código ${created.id}).`
            : `Cadastro realizado com sucesso (código ${created.id}), mas a lista não foi atualizada. Consulte-a novamente.`,
        );
      }
    } finally {
      lock.current = false;
      onBusyChange(false);
      setSaving(false);
    }
  }

  async function reviewList() {
    if (lock.current || busy) {
      return;
    }
    lock.current = true;
    onBusyChange(true);
    setSaving(true);
    try {
      const refreshed = await refresh().catch(() => false);
      if (refreshed) {
        setReviewed(true);
        setMessage(
          'Confira a lista e volte ao formulário antes de decidir criar novamente.',
        );
        onClose();
      } else {
        setMessage(
          'Não foi possível consultar a lista. O envio continua bloqueado.',
        );
      }
    } finally {
      lock.current = false;
      onBusyChange(false);
      setSaving(false);
    }
  }

  const field = (name: string, label: string, placeholder?: string) => (
    <View style={styles.field} key={name}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={styles.input}
        value={fields[name] ?? ''}
        onChangeText={value => setField(name, value)}
        placeholder={placeholder}
        placeholderTextColor="#91a198"
      />
      {!!errors[name] && <Text style={styles.error}>{errors[name]}</Text>}
    </View>
  );
  const choices = (
    name: string,
    label: string,
    options: Option[],
    allowClear = true,
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choices}>
        {allowClear && !!fields[name] && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Limpar ${label}`}
            onPress={() => setField(name, '')}
            style={styles.choice}
          >
            <Text>Limpar</Text>
          </Pressable>
        )}
        {options.map(option => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={option.label}
            key={option.id}
            onPress={() => setField(name, String(option.id))}
            style={[
              styles.choice,
              fields[name] === String(option.id) && styles.selected,
            ]}
          >
            <Text>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      {!!errors[name] && <Text style={styles.error}>{errors[name]}</Text>}
    </View>
  );
  const catalog = (
    name: string,
    label: string,
    data: Catalog,
    retry: () => void,
  ) => (
    <View>
      {choices(name, label, data.options)}
      {!!fields[name] &&
        !data.options.some(option => String(option.id) === fields[name]) && (
          <Text style={styles.hint}>
            Seleção atual: código {fields[name]}. Carregue o catálogo para
            alterar.
          </Text>
        )}
      {data.loading && (
        <Text style={styles.hint}>Carregando {label.toLowerCase()}...</Text>
      )}
      {data.error && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Tentar carregar ${label}`}
          onPress={retry}
        >
          <Text style={styles.error}>
            Não foi possível carregar {label.toLowerCase()}. Toque para tentar
            novamente.
          </Text>
        </Pressable>
      )}
      {!data.loading && !data.error && data.options.length === 0 && (
        <Text style={styles.hint}>Nenhuma opção disponível.</Text>
      )}
    </View>
  );

  return (
    <View
      style={visible ? undefined : styles.hidden}
      pointerEvents={saving || busy ? 'none' : 'auto'}
    >
      <Text style={styles.title}>
        {edit
          ? kind === 'propriedade'
            ? 'Editar propriedade'
            : 'Editar talhão'
          : kind === 'propriedade'
          ? 'Nova propriedade'
          : 'Novo talhão'}
      </Text>
      <Text style={styles.hint}>
        {edit
          ? 'Edição online. As alterações não são mantidas após fechar o aplicativo.'
          : 'Cadastro online. Os dados não são mantidos após fechar o aplicativo.'}
      </Text>
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      )}
      {!!errors.empresa && <Text style={styles.error}>{errors.empresa}</Text>}
      {kind === 'propriedade' ? (
        <>
          {field('nome_propriedade', 'Nome da propriedade *')}
          {field('car', 'CAR *')}
          {field('ccir', 'CCIR')}
          {field('nirf', 'NIRF')}
          <Text style={styles.section}>Localização</Text>
          {field('latitude', 'Latitude *', 'Ex.: -15,7801')}
          {field('longitude', 'Longitude *', 'Ex.: -47,9292')}
          {field('ponto_referencia', 'Ponto de referência')}
          <Text style={styles.hint}>
            Endereço opcional: informe CEP, estado, cidade e logradouro juntos.
          </Text>
          {edit && (
            <Text style={styles.hint}>
              O backend usa Zona Rural quando o bairro fica em branco. Não é
              possível remover o endereço existente.
            </Text>
          )}
          {field('cep', 'CEP')}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buscar CEP"
            disabled={cepLoading}
            onPress={searchCep}
            style={[styles.cepButton, cepLoading && styles.disabled]}
          >
            <Text style={styles.cepButtonText}>
              {cepLoading ? 'Buscando CEP...' : '⌕ Buscar CEP'}
            </Text>
          </Pressable>
          {!!cepMessage && (
            <Text accessibilityLiveRegion="polite" style={styles.hint}>
              {cepMessage}
            </Text>
          )}
          {cepSuggestion && (
            <View>
              <Text style={styles.hint}>
                Sugestão: {cepSuggestion.address.logradouro || 'sem logradouro'}{' '}
                · {cepSuggestion.address.bairro || 'sem bairro'} ·{' '}
                {cepSuggestion.address.localidade}/{cepSuggestion.address.uf}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Aplicar sugestões do CEP"
                onPress={() => {
                  applyCepSuggestion(cepSuggestion, true);
                  setCepSuggestion(null);
                  setCepMessage(
                    'Sugestões aplicadas. Confira o endereço antes de salvar.',
                  );
                }}
                style={styles.cepButton}
              >
                <Text style={styles.cepButtonText}>
                  Aplicar sugestões do CEP
                </Text>
              </Pressable>
            </View>
          )}
          <Text style={styles.label}>Estado</Text>
          <View style={styles.choices}>
            {states.options.map(option => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={option.label}
                key={option.id}
                onPress={() => {
                  setStateId(option.id);
                  setField('id_estado', String(option.id));
                  setField('id_cidade', '');
                  setCitySearch('');
                  loadCities(option.id);
                }}
                style={[
                  styles.choice,
                  stateId === option.id && styles.selected,
                ]}
              >
                <Text>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          {states.loading && (
            <Text style={styles.hint}>Carregando estados...</Text>
          )}
          {states.error && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tentar carregar estados"
              onPress={loadStates}
            >
              <Text style={styles.error}>
                Não foi possível carregar estados. Toque para tentar novamente.
              </Text>
            </Pressable>
          )}
          {stateId !== null &&
            !states.options.some(option => option.id === stateId) && (
              <Text style={styles.hint}>
                Estado atual: código {stateId}. Carregue os estados para
                alterar.
              </Text>
            )}
          {stateId !== null && (
            <>
              <TextInput
                accessibilityLabel="Buscar cidade"
                style={styles.input}
                value={citySearch}
                onChangeText={setCitySearch}
                placeholder="Buscar cidade"
              />
              {catalog(
                'id_cidade',
                'Cidade',
                {
                  ...cities,
                  options: cities.options
                    .filter(
                      option =>
                        option.id === Number(fields.id_cidade) ||
                        option.label
                          .toLocaleLowerCase()
                          .includes(citySearch.toLocaleLowerCase()),
                    )
                    .slice(0, 40),
                },
                () => loadCities(stateId),
              )}
            </>
          )}
          {!!errors.id_cidade && stateId === null && (
            <Text style={styles.error}>{errors.id_cidade}</Text>
          )}
          {field('logradouro', 'Logradouro / acesso')}
          {field('bairro', 'Bairro')}
          {field('numero', 'Número')}
          {field('complemento', 'Complemento')}
          <Text style={styles.section}>Áreas em hectares</Text>
          {field('area_total', 'Área total (ha) *')}
          {field('area_agricultavel', 'Área agricultável (ha) *')}
          {field('area_preservacao', 'Área de preservação (ha) *')}
          {field('area_pastagem', 'Área de pastagem (ha)')}
          {field('area_vegetacao_nativa', 'Área de vegetação nativa (ha)')}
          {field('altitude_media', 'Altitude média (m)')}
          {catalog(
            'id_classe_capacidade_uso',
            'Classe de uso',
            classes,
            loadClasses,
          )}
        </>
      ) : (
        <>
          {field('nome_talhao', 'Nome do talhão *')}
          {field('codigo_talhao', 'Código do talhão *')}
          {edit ? (
            <View style={styles.field}>
              <Text style={styles.label}>Propriedade vinculada</Text>
              <Text>
                {String(
                  edit.property?.nome_propriedade ?? fields.id_propriedade,
                )}
              </Text>
            </View>
          ) : (
            choices(
              'id_propriedade',
              'Propriedade *',
              properties
                .filter(
                  item =>
                    item.id_empresa === user.id_empresa &&
                    user.id_empresa !== null,
                )
                .map(item => ({
                  id: item.id_propriedade,
                  label: item.nome_propriedade,
                })),
              false,
            )
          )}
          {!edit &&
            properties.filter(
              item =>
                item.id_empresa === user.id_empresa && user.id_empresa !== null,
            ).length === 0 && (
              <Text style={styles.hint}>
                Nenhuma propriedade disponível. Cadastre uma propriedade
                primeiro.
              </Text>
            )}
          {field('area_total', 'Área total (ha) *')}
          {field(
            'area_utilizavel',
            'Área utilizável (ha)',
            edit
              ? 'Em branco: sem área utilizável'
              : 'Em branco: usa a área total',
          )}
          <Text style={styles.label}>Status inicial</Text>
          {!!fields.status_inicial &&
            !STATUS.includes(fields.status_inicial) && (
              <Text style={styles.hint}>
                Seleção atual: {fields.status_inicial}
              </Text>
            )}
          <View style={styles.choices}>
            {STATUS.map(status => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={status}
                key={status}
                onPress={() => setField('status_inicial', status)}
                style={[
                  styles.choice,
                  (fields.status_inicial || 'Livre') === status &&
                    styles.selected,
                ]}
              >
                <Text>{status}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Topografia</Text>
          {!!fields.topografia && !TOPOGRAPHY.includes(fields.topografia) && (
            <Text style={styles.hint}>Seleção atual: {fields.topografia}</Text>
          )}
          <View style={styles.choices}>
            {TOPOGRAPHY.map(topography => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={topography}
                key={topography}
                onPress={() =>
                  setField(
                    'topografia',
                    fields.topografia === topography ? '' : topography,
                  )
                }
                style={[
                  styles.choice,
                  fields.topografia === topography && styles.selected,
                ]}
              >
                <Text>{topography}</Text>
              </Pressable>
            ))}
          </View>
          {field('latitude', 'Latitude')}
          {field('longitude', 'Longitude')}
        </>
      )}
      {catalog('id_tipo_solo', 'Tipo de solo', soil, loadSoil)}
      {field('observacoes', 'Observações')}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          kind === 'propriedade' ? 'Salvar propriedade' : 'Salvar talhão'
        }
        disabled={saving || busy || uncertain}
        onPress={submit}
        style={[
          styles.button,
          (saving || busy || uncertain) && styles.disabled,
        ]}
      >
        <Text style={styles.buttonText}>
          {saving
            ? 'Aguarde...'
            : edit
            ? '✓ Salvar alterações'
            : '✓ Salvar cadastro'}
        </Text>
      </Pressable>
      {uncertain && !edit && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Consultar lista para conferir"
          disabled={saving || busy}
          onPress={reviewList}
          style={styles.secondary}
        >
          <Text>Consultar lista para conferir</Text>
        </Pressable>
      )}
      {uncertain && reviewed && !edit && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirmei que não foi cadastrado"
          onPress={() => {
            setUncertain(false);
            setReviewed(false);
            setMessage(
              'Envio liberado após sua conferência. Revise os dados antes de salvar.',
            );
          }}
          style={styles.secondary}
        >
          <Text>Confirmei que não foi cadastrado</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar para lista"
        disabled={saving || busy}
        onPress={closeForm}
        style={styles.secondary}
      >
        <Text>‹ Voltar para lista</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
  title: { fontSize: 22, fontWeight: '700', color: '#173e2b', marginBottom: 8 },
  section: {
    fontSize: 18,
    fontWeight: '700',
    color: '#173e2b',
    marginTop: 16,
    marginBottom: 8,
  },
  field: { marginVertical: 8 },
  label: { color: '#435c4d', fontWeight: '700', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#c9d8ce',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#183d2a',
    backgroundColor: '#fff',
  },
  hint: { color: '#5e7567', marginVertical: 6 },
  message: {
    color: '#245b39',
    backgroundColor: '#e9f4ed',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  error: { color: '#a43b30', marginVertical: 4 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  choice: {
    borderWidth: 1,
    borderColor: '#c9d8ce',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  selected: { backgroundColor: '#cfeada', borderColor: '#197747' },
  cepButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#197747',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
  },
  cepButtonText: { color: '#197747', fontWeight: '700' },
  button: {
    backgroundColor: '#197747',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondary: { alignItems: 'center', padding: 12 },
});
