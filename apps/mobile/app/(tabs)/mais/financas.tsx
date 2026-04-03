import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { financasService } from '@meudia/api';
import { format } from 'date-fns';
import { useAuth } from '../../../hooks/useAuth';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import { colors } from '../../../lib/colors';

export default function FinancasScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const now = useMemo(() => new Date(), []);
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;

  const { data: transacoes, refetch, isLoading } = useQuery({
    queryKey: ['transacoes', user?.id, ano, mes],
    queryFn: () => financasService.transacoesDoMes(user!.id, ano, mes),
    enabled: !!user?.id,
  });

  const { data: resumo } = useQuery({
    queryKey: ['resumo-mensal', user?.id, ano, mes],
    queryFn: () => financasService.resumoMensal(user!.id, ano, mes),
    enabled: !!user?.id,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Finanças"
        subtitle={`Transações de ${format(new Date(), 'MMMM')}`}
        onBack={() => router.back()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
        {resumo && (
          <Card style={styles.resumoCard}>
            <View style={styles.resumoRow}>
              <View style={styles.resumoItem}>
                <Text style={styles.resumoLabel}>Receitas</Text>
                <Text style={[styles.resumoValue, { color: colors.green }]}>
                  R$ {Number(resumo.totalReceitas ?? 0).toFixed(2)}
                </Text>
              </View>
              <View style={styles.resumoItem}>
                <Text style={styles.resumoLabel}>Despesas</Text>
                <Text style={[styles.resumoValue, { color: colors.red }]}>
                  R$ {Number(resumo.totalDespesas ?? 0).toFixed(2)}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {isLoading && (
          <Card><Text style={styles.loadingText}>Carregando...</Text></Card>
        )}

        {!isLoading && (!transacoes || transacoes.length === 0) && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>💰</Text>
            <Text style={styles.emptyTitle}>Nenhuma transação</Text>
            <Text style={styles.emptySubtitle}>Registre receitas e despesas para controlar suas finanças</Text>
          </Card>
        )}

        {transacoes?.map((t: { id: string; descricao: string; valor: number; tipo: string; data?: string }) => (
          <TouchableOpacity key={t.id} activeOpacity={0.7}>
            <Card>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{t.descricao}</Text>
                <Text style={[styles.itemValor, { color: t.tipo === 'receita' ? colors.green : colors.red }]}>
                  {t.tipo === 'receita' ? '+' : '-'} R$ {Math.abs(Number(t.valor)).toFixed(2)}
                </Text>
              </View>
              {t.data && (
                <Text style={styles.itemMeta}>
                  {new Date(t.data).toLocaleDateString('pt-BR')}
                </Text>
              )}
            </Card>
          </TouchableOpacity>
        ))}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 12 },
  resumoCard: { paddingVertical: 16 },
  resumoRow: { flexDirection: 'row', justifyContent: 'space-around' },
  resumoItem: { alignItems: 'center' },
  resumoLabel: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  resumoValue: { fontSize: 18, fontWeight: '700' },
  loadingText: { color: colors.muted, textAlign: 'center' },
  emptyCard: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.muted, marginTop: 4 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  itemValor: { fontSize: 15, fontWeight: '700' },
  itemMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },
});
