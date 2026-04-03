import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { habitoService } from '@meudia/api';
import { format } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Card } from '../../components/ui/Card';
import { colors } from '../../lib/colors';

export default function HabitosScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const hoje = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const { data: habitos, refetch: refetchHabitos, isLoading } = useQuery({
    queryKey: ['habitos', user?.id],
    queryFn: () => habitoService.listarHabitos(user!.id),
    enabled: !!user?.id,
  });

  const { data: registros } = useQuery({
    queryKey: ['registros-hoje', user?.id, hoje],
    queryFn: () => habitoService.obterRegistrosHoje(user!.id),
    enabled: !!user?.id,
  });

  const marcar = useMutation({
    mutationFn: ({ habitoId, concluido }: { habitoId: string; concluido: boolean }) =>
      habitoService.marcarHabito(user!.id, habitoId, hoje, concluido),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['registros-hoje', user?.id] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchHabitos();
    setRefreshing(false);
  }, [refetchHabitos]);

  const registroMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (registros && Array.isArray(registros)) {
      for (const r of registros as { habito_id: string; concluido: boolean }[]) {
        map.set(r.habito_id, r.concluido);
      }
    }
    return map;
  }, [registros]);

  const completados = Array.from(registroMap.values()).filter(Boolean).length;
  const total = habitos?.length ?? 0;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Hábitos"
        subtitle={total > 0 ? `${completados}/${total} hoje` : 'Seus hábitos diários'}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
        {/* Barra de progresso */}
        {total > 0 && (
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${(completados / total) * 100}%` }]}
            />
          </View>
        )}

        {isLoading && (
          <Card><Text style={styles.loadingText}>Carregando...</Text></Card>
        )}

        {!isLoading && total === 0 && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyTitle}>Nenhum hábito</Text>
            <Text style={styles.emptySubtitle}>Crie hábitos diários para acompanhar</Text>
          </Card>
        )}

        {habitos?.map((habito: { id: string; nome: string; icone?: string }) => {
          const concluido = registroMap.get(habito.id) ?? false;
          return (
            <TouchableOpacity
              key={habito.id}
              activeOpacity={0.7}
              onPress={() => marcar.mutate({ habitoId: habito.id, concluido: !concluido })}
            >
              <Card style={concluido ? { ...styles.habitoCard, ...styles.habitoConcluido } : styles.habitoCard}>
                <View style={[styles.checkbox, concluido && styles.checkboxDone]}>
                  {concluido && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.habitoInfo}>
                  <Text style={[styles.habitoNome, concluido && styles.habitoNomeDone]}>
                    {habito.icone ? `${habito.icone} ` : ''}{habito.nome}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 12 },
  progressBar: {
    height: 6,
    backgroundColor: colors.card2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.green,
    borderRadius: 3,
  },
  loadingText: { color: colors.muted, textAlign: 'center' },
  emptyCard: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.muted, marginTop: 4 },
  habitoCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  habitoConcluido: { opacity: 0.7 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxDone: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  checkmark: {
    color: colors.bg,
    fontWeight: '800',
    fontSize: 14,
  },
  habitoInfo: { flex: 1 },
  habitoNome: { fontSize: 15, fontWeight: '500', color: colors.text },
  habitoNomeDone: { textDecorationLine: 'line-through', color: colors.muted },
});
