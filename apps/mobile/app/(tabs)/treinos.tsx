import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { treinoService } from '@meudia/api';
import { useAuth } from '../../hooks/useAuth';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Card } from '../../components/ui/Card';
import { colors } from '../../lib/colors';

export default function TreinosScreen() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data: treinos, refetch, isLoading } = useQuery({
    queryKey: ['treinos', user?.id],
    queryFn: () => treinoService.listarTreinos(user!.id),
    enabled: !!user?.id,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Treinos" subtitle={`${treinos?.length ?? 0} treinos cadastrados`} />
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

        {!isLoading && (!treinos || treinos.length === 0) && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>💪</Text>
            <Text style={styles.emptyTitle}>Nenhum treino</Text>
            <Text style={styles.emptySubtitle}>Crie seu primeiro treino para começar</Text>
          </Card>
        )}

        {treinos?.map((treino: { id: string; nome: string; descricao?: string; exercicios?: unknown[] }) => (
          <TouchableOpacity key={treino.id} activeOpacity={0.7}>
            <Card>
              <View style={styles.treinoHeader}>
                <Text style={styles.treinoNome}>{treino.nome}</Text>
                <Text style={styles.treinoCount}>
                  {treino.exercicios?.length ?? 0} exercícios
                </Text>
              </View>
              {treino.descricao && (
                <Text style={styles.treinoDesc}>{treino.descricao}</Text>
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
  loadingText: { color: colors.muted, textAlign: 'center' },
  emptyCard: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.muted, marginTop: 4 },
  treinoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  treinoNome: { fontSize: 16, fontWeight: '600', color: colors.text },
  treinoCount: { fontSize: 12, color: colors.muted },
  treinoDesc: { fontSize: 13, color: colors.muted, marginTop: 6 },
});
