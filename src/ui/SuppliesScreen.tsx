import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Connectivity } from '../app/sync/connectivity';
import {
  loadSupplies,
  loadVerifiedSupply,
  type Movement,
  type Supply,
  type SupplyProperty,
} from '../app/supplies/supplyData';
import {
  BackendError,
  type BackendClient,
  type Usuario,
} from '../infra/api/BackendClient';

type Category = {
  id_categoria_insumo: number;
  nome_categoria: string;
  status: boolean;
};
type Product = {
  id_produto: number;
  nome_produto: string;
  unidade_medida: string;
  status: boolean;
};
type Page = 'list' | 'detail' | 'create' | 'edit' | 'movement';

function Button({
  label,
  onPress,
  disabled = false,
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
  numeric = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  numeric?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        style={styles.input}
      />
    </View>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.selected]}
    >
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  );
}

function numberValue(
  value: string,
  decimalPlaces: number,
  integerDigits: number,
) {
  const clean = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(clean)) return null;
  const [whole, fraction = ''] = clean.split('.');
  if (
    (whole.replace(/^0+/, '') || '0').length > integerDigits ||
    fraction.length > decimalPlaces
  )
    return null;
  const number = Number(clean);
  return Number.isFinite(number) ? number : null;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function SuppliesScreen({
  client,
  user,
  connectivity,
  busy,
  onBusyChange,
  uncertain,
  onUncertainChange,
}: {
  client: BackendClient;
  user: Usuario;
  connectivity: Connectivity;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  uncertain: boolean;
  onUncertainChange: (uncertain: boolean) => void;
}) {
  const [page, setPage] = useState<Page>('list');
  const [items, setItems] = useState<Supply[]>([]);
  const [properties, setProperties] = useState<SupplyProperty[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [selected, setSelected] = useState<Supply | null>(null);
  const [history, setHistory] = useState<Movement[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [productId, setProductId] = useState<number | null>(null);
  const [newProduct, setNewProduct] = useState(true);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [minimum, setMinimum] = useState('0');
  const [price, setPrice] = useState('0');
  const [active, setActive] = useState(true);
  const [quantity, setQuantity] = useState('0');
  const [movementType, setMovementType] = useState<'ENTRADA' | 'SAIDA'>(
    'ENTRADA',
  );
  const [lot, setLot] = useState('');
  const [lotId, setLotId] = useState<number | null>(null);
  const [expiry, setExpiry] = useState('');
  const [observation, setObservation] = useState('');
  const [confirm, setConfirm] = useState<'delete' | 'movement' | null>(null);
  const requestId = useRef(0);
  const lock = useRef(false);

  const refresh = useCallback(async () => {
    if (connectivity !== 'online') return false;
    const request = ++requestId.current;
    setLoading(true);
    try {
      const result = await loadSupplies(client, user);
      if (request !== requestId.current) return false;
      setItems(result.items);
      setProperties(result.properties);
      setLoaded(true);
      setError('');
      return true;
    } catch {
      if (request === requestId.current)
        setError(
          'Não foi possível carregar insumos ou verificar suas propriedades.',
        );
      return false;
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [client, connectivity, user]);

  useEffect(() => {
    if (connectivity === 'online') refresh();
    else setLoading(false);
    return () => {
      requestId.current += 1;
    };
  }, [connectivity, refresh]);

  async function openDetail(id: number) {
    if (connectivity !== 'online' || busy) return;
    const request = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const item = await loadVerifiedSupply(client, user, id);
      let movements: Movement[] = [];
      let movementError = '';
      try {
        const result = await client.request<Movement[]>(
          `/movimentacoes?id_insumo=${id}`,
        );
        if (!Array.isArray(result)) throw new Error();
        movements = result.filter(movement => movement.id_insumo === id);
      } catch {
        movementError = 'Não foi possível carregar as movimentações.';
      }
      if (request !== requestId.current) return;
      setSelected(item);
      setHistory(movements);
      setHistoryError(movementError);
      setPage('detail');
    } catch {
      if (request === requestId.current)
        setError('Não foi possível abrir o insumo ou confirmar seu vínculo.');
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }

  async function openCreate() {
    if (connectivity !== 'online' || busy || uncertain) return;
    setLoading(true);
    try {
      const data = await loadSupplies(client, user);
      const [nextCategories, nextProducts] = await Promise.all([
        client.request<Category[]>('/categorias-insumo'),
        client.request<Product[]>('/produtos'),
      ]);
      if (!Array.isArray(nextCategories) || !Array.isArray(nextProducts))
        throw new Error();
      setProperties(data.properties);
      setCategories(nextCategories.filter(item => item.status));
      setProducts(
        nextProducts.filter(
          item =>
            item.status &&
            !data.items.some(supply => supply.id_produto === item.id_produto),
        ),
      );
      setPropertyId(null);
      setCategoryId(null);
      setProductId(null);
      setNewProduct(true);
      setName('');
      setUnit('');
      setMinimum('0');
      setPrice('0');
      setQuantity('0');
      setNotice('');
      setError('');
      setPage('create');
    } catch {
      setError('Não foi possível carregar os dados para cadastro.');
    } finally {
      setLoading(false);
    }
  }

  function openEdit() {
    if (!selected || uncertain) return;
    setMinimum(String(selected.estoque_minimo));
    setPrice(String(selected.valor_unitario));
    setActive(selected.status);
    setNotice('');
    setError('');
    setPage('edit');
  }

  function openMovement(type: 'ENTRADA' | 'SAIDA') {
    if (!selected || uncertain) return;
    setMovementType(type);
    setQuantity('');
    setLot('');
    setLotId(null);
    setExpiry('');
    setObservation('');
    setNotice('');
    setError('');
    setPage('movement');
  }

  async function submit(kind: 'create' | 'edit' | 'delete' | 'movement') {
    if (lock.current || connectivity !== 'online' || uncertain) return;
    const minimumValue = numberValue(minimum, 3, 11);
    const priceValue = numberValue(price, 2, 12);
    const quantityValue = numberValue(quantity, 3, 11);
    if (
      (kind === 'create' || kind === 'edit') &&
      (minimumValue === null || priceValue === null)
    ) {
      setError(
        'Informe estoque mínimo e valor unitário válidos, não negativos.',
      );
      return;
    }
    if (
      kind === 'create' &&
      (!propertyId ||
        quantityValue === null ||
        (newProduct ? !name.trim() || !unit.trim() || !categoryId : !productId))
    ) {
      setError('Preencha propriedade, produto e estoque inicial válido.');
      return;
    }
    if (kind === 'movement' && (quantityValue === null || quantityValue <= 0)) {
      setError('Informe uma quantidade maior que zero.');
      return;
    }
    if (kind === 'movement' && expiry && !validDate(expiry)) {
      setError('Informe uma data de validade válida no formato AAAA-MM-DD.');
      return;
    }
    if (kind === 'movement' && expiry && !lot.trim()) {
      setError('Informe o número do lote para registrar a validade.');
      return;
    }
    if (
      (kind === 'create' &&
        (name.trim().length > 200 || unit.trim().length > 20)) ||
      (kind === 'movement' &&
        (lot.trim().length > 50 || observation.trim().length > 500))
    ) {
      setError('Um dos campos informados excede o tamanho permitido.');
      return;
    }
    lock.current = true;
    onBusyChange(true);
    setError('');
    setNotice('');
    let sent = false;
    try {
      let payload: Record<string, unknown> = {};
      let path = '';
      let method = 'POST';
      if (kind === 'create') {
        const verified = await loadSupplies(client, user);
        if (
          !verified.properties.some(
            property => property.id_propriedade === propertyId,
          )
        )
          throw new Error();
        payload = {
          ...(newProduct
            ? {
                produto: {
                  nome_produto: name.trim(),
                  unidade_medida: unit.trim(),
                  id_categoria_insumo: categoryId,
                },
              }
            : { id_produto: productId }),
          id_propriedade: propertyId,
          estoque_minimo: minimumValue,
          valor_unitario: priceValue,
          estoque_atual: quantityValue,
          status: true,
        };
        path = '/insumos';
      } else {
        if (!selected) throw new Error();
        const verified = await loadVerifiedSupply(
          client,
          user,
          selected.id_insumo,
        );
        if (
          kind === 'movement' &&
          movementType === 'SAIDA' &&
          lotId !== null &&
          (!Array.isArray(verified.lotes) ||
            !verified.lotes.some(item => item.id_lote === lotId))
        )
          throw new Error();
        path = `/insumos/${selected.id_insumo}`;
        if (kind === 'edit') {
          method = 'PUT';
          payload = {
            estoque_minimo: minimumValue,
            valor_unitario: priceValue,
            status: active,
          };
        }
        if (kind === 'delete') method = 'DELETE';
        if (kind === 'movement') {
          path = '/movimentacoes';
          payload = {
            id_insumo: selected.id_insumo,
            tipo_movimentacao: movementType,
            quantidade: quantityValue,
            ...(observation.trim() ? { observacao: observation.trim() } : {}),
            ...(movementType === 'ENTRADA' && lot.trim()
              ? { numero_lote: lot.trim() }
              : {}),
            ...(movementType === 'ENTRADA' && expiry
              ? { data_validade: expiry }
              : {}),
            ...(movementType === 'SAIDA' && lotId !== null
              ? { id_lote: lotId }
              : {}),
          };
        }
      }
      sent = true;
      await client.request(
        path,
        method,
        method === 'DELETE' ? undefined : payload,
      );
      setConfirm(null);
      const refreshed = await refresh();
      setNotice(
        refreshed
          ? 'Operação confirmada pelo servidor.'
          : 'Operação confirmada, mas a lista não foi atualizada.',
      );
      setPage('list');
      setSelected(null);
    } catch (failure) {
      if (
        sent &&
        !(
          failure instanceof BackendError &&
          failure.status >= 400 &&
          failure.status < 500
        )
      ) {
        onUncertainChange(true);
        setError(
          'Resultado desconhecido. Confira a lista ou o histórico antes de tentar novamente; não houve reenvio automático.',
        );
      } else {
        setError(
          sent
            ? 'O servidor recusou a operação. Confira os dados e as regras de estoque.'
            : 'Não foi possível confirmar a sessão e o vínculo. Nenhuma operação foi enviada.',
        );
      }
      setConfirm(null);
    } finally {
      lock.current = false;
      onBusyChange(false);
    }
  }

  const visible = items.filter(
    item =>
      `${item.nome_produto ?? ''} ${item.categoria_nome ?? ''} ${
        item.nome_propriedade ?? ''
      }`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!onlyLow || item.estoque_atual < item.estoque_minimo),
  );
  const low = items.filter(
    item => item.estoque_atual < item.estoque_minimo,
  ).length;
  const stockValue = items.every(
    item =>
      Number.isFinite(item.estoque_atual) &&
      Number.isFinite(item.valor_unitario),
  )
    ? items.reduce(
        (total, item) => total + item.estoque_atual * item.valor_unitario,
        0,
      )
    : null;
  const offline = connectivity !== 'online';

  return (
    <View style={styles.container}>
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={styles.info}>
          {notice}
        </Text>
      )}
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}
      {uncertain && (
        <Text style={styles.error}>
          Confira a lista ou o histórico no servidor antes de liberar novas
          operações.
        </Text>
      )}
      {offline && page !== 'list' && (
        <Text style={styles.error}>
          Sem conexão. Os dados exibidos podem estar desatualizados; operações
          estão indisponíveis.
        </Text>
      )}
      {page === 'list' && (
        <>
          {uncertain && loaded && !loading && !error && !offline && (
            <Button
              label="Conferi no servidor e quero liberar operações"
              onPress={() => onUncertainChange(false)}
              disabled={busy}
            />
          )}
          <Text style={styles.title}>Insumos da empresa</Text>
          {loading && <Text style={styles.muted}>Carregando insumos...</Text>}
          {offline && (
            <Text style={styles.error}>
              {loaded
                ? 'Dados carregados anteriormente e possivelmente desatualizados.'
                : 'Insumos do servidor indisponíveis. Conecte-se para consultar.'}
            </Text>
          )}
          {loaded && !!error && (
            <Text style={styles.error}>
              Dados anteriores podem estar desatualizados.
            </Text>
          )}
          <View style={styles.summary}>
            <Text style={styles.title}>
              {loaded ? items.length : '—'} insumos
            </Text>
            <Text style={styles.muted}>
              {loaded ? low : '—'} com estoque abaixo do mínimo
            </Text>
            <Text style={styles.muted}>
              Valor estimado do estoque:{' '}
              {loaded && stockValue !== null
                ? `R$ ${stockValue.toFixed(2)}`
                : '—'}
            </Text>
          </View>
          <Button
            label="+ Novo insumo"
            onPress={openCreate}
            disabled={offline || loading || busy || uncertain}
          />
          <Field
            label="Buscar insumos"
            value={search}
            onChangeText={setSearch}
          />
          <Choice
            label="Apenas estoque baixo"
            selected={onlyLow}
            onPress={() => setOnlyLow(!onlyLow)}
          />
          <Button
            label="Atualizar insumos"
            onPress={() => {
              refresh();
            }}
            disabled={offline || loading || busy}
          />
          {loaded && !loading && !error && visible.length === 0 && (
            <Text style={styles.muted}>Nenhum insumo encontrado.</Text>
          )}
          {visible.map(item => (
            <Pressable
              key={item.id_insumo}
              accessibilityRole="button"
              accessibilityLabel={`Consultar insumo ${item.nome_produto}`}
              onPress={() => openDetail(item.id_insumo)}
              disabled={offline || loading || busy}
              style={styles.card}
            >
              <Text style={styles.title}>{item.nome_produto}</Text>
              <Text style={styles.muted}>
                {item.nome_propriedade} ·{' '}
                {item.categoria_nome || 'Sem categoria'}
              </Text>
              <Text style={styles.muted}>
                Estoque: {item.estoque_atual} {item.unidade_medida} ·{' '}
                {item.status ? 'Ativo' : 'Inativo'}
              </Text>
            </Pressable>
          ))}
        </>
      )}
      {page === 'detail' && selected && (
        <>
          <Button
            label="Voltar para insumos"
            onPress={() => {
              setPage('list');
              setConfirm(null);
            }}
            disabled={busy}
          />
          <View style={styles.card}>
            <Text style={styles.title}>{selected.nome_produto}</Text>
            <Text style={styles.muted}>
              {selected.nome_propriedade} · {selected.categoria_nome}
            </Text>
            <Text style={styles.muted}>
              Estoque: {selected.estoque_atual} {selected.unidade_medida} ·
              Mínimo: {selected.estoque_minimo}
            </Text>
            <Text style={styles.muted}>
              Valor unitário: R$ {Number(selected.valor_unitario).toFixed(2)} ·{' '}
              {selected.status ? 'Ativo' : 'Inativo'}
            </Text>
          </View>
          <Text style={styles.title}>Lotes</Text>
          {(Array.isArray(selected.lotes) ? selected.lotes : []).map(item => (
            <Text style={styles.muted} key={item.id_lote}>
              {item.numero_lote || 'Sem número'} · {item.quantidade}{' '}
              {selected.unidade_medida} · Validade:{' '}
              {item.data_validade || 'não informada'}
            </Text>
          ))}
          <Button
            label="Editar insumo"
            onPress={openEdit}
            disabled={offline || busy || uncertain}
          />
          <Button
            label="Entrada de estoque"
            onPress={() => openMovement('ENTRADA')}
            disabled={offline || busy || uncertain}
          />
          <Button
            label="Saída de estoque"
            onPress={() => openMovement('SAIDA')}
            disabled={offline || busy || uncertain}
          />
          {confirm === 'delete' ? (
            <>
              <Text style={styles.error}>
                Excluir {selected.nome_produto}? Esta ação não pode ser
                desfeita.
              </Text>
              <Button
                label="Confirmar exclusão"
                onPress={() => {
                  submit('delete');
                }}
                disabled={offline || busy}
              />
              <Button
                label="Cancelar exclusão"
                onPress={() => setConfirm(null)}
                disabled={busy}
              />
            </>
          ) : (
            <Button
              label="Excluir insumo"
              onPress={() => setConfirm('delete')}
              disabled={offline || busy || uncertain}
            />
          )}
          <Text style={styles.title}>Histórico de movimentações</Text>
          {!!historyError && <Text style={styles.error}>{historyError}</Text>}
          {!historyError && history.length === 0 && (
            <Text style={styles.muted}>Nenhuma movimentação encontrada.</Text>
          )}
          {history.map(item => (
            <Text style={styles.muted} key={item.id_movimentacao}>
              {item.tipo_movimentacao} · {item.quantidade}{' '}
              {selected.unidade_medida} ·{' '}
              {item.data_movimentacao || 'Data não informada'}
            </Text>
          ))}
        </>
      )}
      {(page === 'create' || page === 'edit') && (
        <>
          <Button
            label="Cancelar cadastro de insumo"
            onPress={() => {
              setPage(page === 'edit' ? 'detail' : 'list');
              setError('');
            }}
            disabled={busy}
          />
          <Text style={styles.title}>
            {page === 'create' ? 'Novo insumo' : 'Editar insumo'}
          </Text>
          {page === 'create' && (
            <>
              <Text style={styles.label}>Propriedade</Text>
              <View style={styles.choices}>
                {properties.map(property => (
                  <Choice
                    key={property.id_propriedade}
                    label={property.nome_propriedade}
                    selected={propertyId === property.id_propriedade}
                    onPress={() => setPropertyId(property.id_propriedade)}
                  />
                ))}
              </View>
              {properties.length === 0 && (
                <Text style={styles.error}>
                  Nenhuma propriedade verificada disponível.
                </Text>
              )}
              <View style={styles.choices}>
                <Choice
                  label="Produto novo"
                  selected={newProduct}
                  onPress={() => setNewProduct(true)}
                />
                <Choice
                  label="Produto existente"
                  selected={!newProduct}
                  onPress={() => setNewProduct(false)}
                />
              </View>
              {newProduct ? (
                <>
                  <Field
                    label="Nome do produto"
                    value={name}
                    onChangeText={setName}
                  />
                  <Field
                    label="Unidade de medida"
                    value={unit}
                    onChangeText={setUnit}
                  />
                  <Text style={styles.label}>Categoria</Text>
                  <View style={styles.choices}>
                    {categories.map(item => (
                      <Choice
                        key={item.id_categoria_insumo}
                        label={item.nome_categoria}
                        selected={categoryId === item.id_categoria_insumo}
                        onPress={() => setCategoryId(item.id_categoria_insumo)}
                      />
                    ))}
                  </View>
                </>
              ) : (
                <View style={styles.choices}>
                  {products.map(item => (
                    <Choice
                      key={item.id_produto}
                      label={`${item.nome_produto} · ${item.unidade_medida}`}
                      selected={productId === item.id_produto}
                      onPress={() => setProductId(item.id_produto)}
                    />
                  ))}
                </View>
              )}
              <Field
                label="Estoque inicial"
                value={quantity}
                onChangeText={setQuantity}
                numeric
              />
              <Text style={styles.muted}>
                Estoque inicial maior que zero gera uma entrada.
              </Text>
            </>
          )}
          {page === 'edit' && (
            <>
              <Text style={styles.muted}>
                Saldo é alterado por movimentação. Dados do produto
                compartilhado não são editados aqui.
              </Text>
              <View style={styles.choices}>
                <Choice
                  label="Ativo"
                  selected={active}
                  onPress={() => setActive(true)}
                />
                <Choice
                  label="Inativo"
                  selected={!active}
                  onPress={() => setActive(false)}
                />
              </View>
            </>
          )}
          <Field
            label="Estoque mínimo"
            value={minimum}
            onChangeText={setMinimum}
            numeric
          />
          <Field
            label="Valor unitário"
            value={price}
            onChangeText={setPrice}
            numeric
          />
          <Button
            label="Salvar insumo"
            onPress={() => {
              submit(page);
            }}
            disabled={offline || busy || uncertain}
          />
        </>
      )}
      {page === 'movement' && selected && (
        <>
          <Button
            label="Cancelar movimentação"
            onPress={() => {
              setPage('detail');
              setConfirm(null);
            }}
            disabled={busy}
          />
          <Text style={styles.title}>
            {movementType === 'ENTRADA' ? 'Entrada' : 'Saída'} ·{' '}
            {selected.nome_produto}
          </Text>
          <Field
            label="Quantidade"
            value={quantity}
            onChangeText={setQuantity}
            numeric
          />
          {movementType === 'ENTRADA' && (
            <>
              <Field
                label="Número do lote (opcional)"
                value={lot}
                onChangeText={setLot}
              />
              <Field
                label="Validade AAAA-MM-DD (opcional)"
                value={expiry}
                onChangeText={setExpiry}
              />
            </>
          )}
          {movementType === 'SAIDA' && (
            <>
              <Text style={styles.label}>Lote de saída</Text>
              <Text style={styles.muted}>
                Na seleção automática, o servidor escolhe os lotes disponíveis.
                A seleção de um lote pode permitir saída de lote vencido.
              </Text>
              <View style={styles.choices}>
                <Choice
                  label="Seleção automática de lote"
                  selected={lotId === null}
                  onPress={() => setLotId(null)}
                />
                {(Array.isArray(selected.lotes) ? selected.lotes : []).map(
                  item => (
                    <Choice
                      key={item.id_lote}
                      label={`Lote ${item.numero_lote || item.id_lote} · ${
                        item.quantidade
                      } · validade ${item.data_validade || 'não informada'}`}
                      selected={lotId === item.id_lote}
                      onPress={() => setLotId(item.id_lote)}
                    />
                  ),
                )}
              </View>
            </>
          )}
          <Field
            label="Observação (opcional)"
            value={observation}
            onChangeText={setObservation}
          />
          {confirm === 'movement' ? (
            <>
              <Text style={styles.error}>
                Confirmar {movementType === 'ENTRADA' ? 'entrada' : 'saída'} de{' '}
                {quantity} {selected.unidade_medida} para{' '}
                {selected.nome_produto}?
              </Text>
              <Button
                label="Confirmar movimentação"
                onPress={() => {
                  submit('movement');
                }}
                disabled={offline || busy}
              />
              <Button
                label="Revisar movimentação"
                onPress={() => setConfirm(null)}
                disabled={busy}
              />
            </>
          ) : (
            <Button
              label="Revisar e confirmar"
              onPress={() => setConfirm('movement')}
              disabled={offline || busy || uncertain}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1ebe2',
  },
  summary: { backgroundColor: '#e9f4e8', borderRadius: 16, padding: 16 },
  title: { color: '#17382b', fontWeight: '800', fontSize: 16 },
  muted: { color: '#61786c', fontSize: 13, lineHeight: 20, marginTop: 4 },
  error: { color: '#8c3d2c', fontSize: 13, lineHeight: 20 },
  info: { color: '#17603d', fontSize: 13 },
  button: {
    minHeight: 44,
    backgroundColor: '#187647',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  field: { gap: 5 },
  label: { color: '#476257', fontWeight: '700', fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: '#d8e6db',
    color: '#183328',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    borderWidth: 1,
    borderColor: '#d8e6db',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 12,
  },
  selected: { backgroundColor: '#dff4e3', borderColor: '#187647' },
  choiceText: { color: '#17382b' },
});
