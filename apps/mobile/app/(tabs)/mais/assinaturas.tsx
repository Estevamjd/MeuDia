import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { assinaturasService } from '@meudia/api';
import { useAuth } from '../../../hooks/useAuth';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import { colors } from '../../../lib/colors';

export default function AssinaturasScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: assinaturas, refetch, isLoading } = useQuery({
    queryKey: ['assinaturas', user?.id],
    queryFn: () => assinaturasService.listarAssinaturas(user!.id),
    enabled: !!user?.id,
  });

  const { data: totalMensal } = useQuery({
    queryKey: ['assinaturas-total', user?.id],
    queryFn: () => assinaturasService.totalMensal(user!.id),
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
        title="Assinaturas"
        subtitle={`${assinaturas?.length ?? 0} assinaturas ativas`}
        onBack={() => router.back()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
        {totalMensal != null && (
          <Card style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total mensal</Text>
            <Text style={styles.totalValue}>R$ {Number(totalMensal).toFixed(2)}</Text>
          </Card>
        )}

        {isLoading && (
          <Card><Text style={styles.loadingText}>Carregando...</Text></Card>
        )}

        {!isLoading && (!assinaturas || assinaturas.length === 0) && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>💳</Text>
            <Text style={styles.emptyTitle}>Nenhuma assinatura</Text>
            <Text style={styles.emptySubtitle}>Cadastre seus serviços recorrentes para acompanhar os gastos</Text>
          </Card>
        )}

        {assinaturas?.map((a: { id: string; nome: string; valor: number; dia_vencimento: number }) => (
          <TouchableOpacity key={a.id} activeOpacity={0.7}>
            <Card>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{a.nome}</Text>
                <Text style={styles.itemValor}>R$ {Number(a.valor).toFixed(2)}</Text>
              </View>
              <Text style={styles.itemMeta}>Vence dia {a.dia_vencimento}</Text>
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
  totalCard: { alignItems: 'center', paddingVertical: 16 },
  totalLabel: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  totalValue: { fontSize: 24, fontWeight: '800', color: colors.accent },
  loadingText: { color: colors.muted, textAlign: 'center' },
  emptyCard: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.muted, marginTop: 4 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 },
  itemValor: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },
});
