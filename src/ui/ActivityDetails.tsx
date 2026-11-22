import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  loadActivity,
  type Activity,
  type ActivityItem,
} from '../app/activities/activityData';
import type { Connectivity } from '../app/sync/connectivity';
import type { BackendClient, Usuario } from '../infra/api/BackendClient';
import type { LocalRecord } from '../infra/db/OfflineRepository';

const statuses: Record<string, string> = {
  pending: 'Pendente',
  syncing: 'Em envio',
  error: 'Com erro — confira a fila antes de qualquer novo envio',
  synced: 'Enviada — aguardando atualização da lista',
};

function value(valueToShow: unknown): string {
  return valueToShow === null || valueToShow === undefined || valueToShow === ''
    ? 'Não informado'
    : String(valueToShow);
}

function detail(label: string, valueToShow: unknown) {
  return (
    <View style={styles.row} key={label}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value(valueToShow)}</Text>
    </View>
  );
}

function items(label: string, list: ActivityItem[] | undefined) {
  if (!Array.isArray(list) || list.length === 0) return detail(label, 'Nenhum');
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {list.map((item, index) => (
        <Text style={styles.value} key={index}>
          {value(item.nome)}
          {item.quantidade != null
            ? ` · ${item.quantidade} ${item.unidade ?? ''}`
            : ''}
          {item.horas != null ? ` · ${item.horas} h` : ''}
          {item.custo != null ? ` · R$ ${item.custo}` : ''}
          {item.baixado === true ? ' · baixado' : ''}
        </Text>
      ))}
    </View>
  );
}

export function ActivityDetails({
  client,
  user,
  connectivity,
  remoteId,
  local,
  onClose,
}: {
  client: BackendClient;
  user: Usuario;
  connectivity: Connectivity;
  remoteId: number | null;
  local: LocalRecord | null;
  onClose: () => void;
}) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (remoteId === null) return;
    let active = true;
    setActivity(null);
    if (connectivity !== 'online') {
      setLoading(false);
      setError('É necessário estar online para consultar esta atividade.');
    } else {
      setLoading(true);
      setError('');
      loadActivity(client, user, remoteId)
        .then(result => {
          if (active) setActivity(result);
        })
        .catch(() => {
          if (active)
            setError(
              'Não foi possível carregar a atividade ou confirmar seus vínculos.',
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [attempt, client, connectivity, remoteId, user]);

  let localData: Record<string, unknown> | null = null;
  if (local) {
    try {
      const data: unknown = JSON.parse(local.data_json);
      if (data && typeof data === 'object' && !Array.isArray(data))
        localData = data as Record<string, unknown>;
    } catch {
      localData = null;
    }
  }
  const data = activity ?? localData;
  return (
    <View>
      <Text style={styles.title}>Detalhes da atividade</Text>
      {local && (
        <Text style={styles.notice}>
          Registro no aparelho ·{' '}
          {statuses[local.sync_status] ?? 'Estado indisponível'}
        </Text>
      )}
      {loading && <Text style={styles.notice}>Carregando atividade...</Text>}
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}
      {local && !localData && (
        <Text style={styles.error}>
          Não foi possível ler os dados locais desta atividade.
        </Text>
      )}
      {data && (
        <View style={styles.card}>
          {detail('Atividade', data.tipo_atividade)}
          {detail('Categoria', data.categoria)}
          {detail('Propriedade', data.nome_propriedade)}
          {detail('Talhão', data.nome_talhao)}
          {detail('Status', data.status)}
          {detail('Data de início', data.data_inicio)}
          {detail('Data de término', data.data_fim)}
          {detail('Responsável', data.responsavel)}
          {detail('Safra', data.safra)}
          {detail('Custo operacional (R$)', data.custo_operacao)}
          {detail('Custo total (R$)', data.custo_total)}
          {detail('Observações', data.observacoes)}
          {activity && items('Insumos', activity.insumos)}
          {activity && items('Máquinas', activity.maquinas)}
        </View>
      )}
      {!!error && remoteId !== null && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tentar carregar atividade novamente"
          onPress={() => setAttempt(current => current + 1)}
          style={styles.button}
        >
          <Text style={styles.buttonText}>↻ Tentar novamente</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar para atividades"
        onPress={onClose}
        style={styles.back}
      >
        <Text style={styles.backText}>‹ Voltar para atividades</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: '#173e2b', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  notice: { color: '#4d6857', marginVertical: 8 },
  error: { color: '#a43232', marginVertical: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
  },
  row: { marginBottom: 12 },
  label: { color: '#698272', fontSize: 12, fontWeight: '700' },
  value: { color: '#173e2b', fontSize: 15, marginTop: 3 },
  button: {
    backgroundColor: '#197747',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  back: { padding: 14, alignItems: 'center' },
  backText: { color: '#197747', fontWeight: '700' },
});
