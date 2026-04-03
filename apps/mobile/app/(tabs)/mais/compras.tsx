import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { comprasService } from '@meudia/api';
import { useAuth } from '../../../hooks/useAuth';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import { colors } from '../../../lib/colors';

export default function ComprasScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: listas, refetch, isLoading } = useQuery({
    queryKey: ['listas-compras', user?.id],
    queryFn: () => comprasService.listarListas(user!.id),
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
        title="Compras"
        subtitle={`${listas?.length ?? 0} listas`}
        onBack={() => router.back()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
        {isLoading && (
          <Card><Text style={styles.loadingText}>Carregando...</Text></Card>
        )}

        {!isLoading && (!listas || listas.length === 0) && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={styles.emptyTitle}>Nenhuma lista</Text>
            <Text style={styles.emptySubtitle}>Crie listas de compras para organizar suas idas ao mercado</Text>
          </Card>
        )}

        {listas?.map((lista: { id: string; nome: string; itens?: unknown[] }) => (
          <TouchableOpacity key={lista.id} activeOpacity={0.7}>
            <Card>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{lista.nome}</Text>
                <Text style={styles.itemMeta}>
                  {lista.itens?.length ?? 0} itens
                </Text>
              </View>
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
  loadingText: { color: colors.muted, textAlign: 'center' },
  emptyCard: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.muted, marginTop: 4 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 },
  itemMeta: { fontSize: 12, color: colors.muted },
});
