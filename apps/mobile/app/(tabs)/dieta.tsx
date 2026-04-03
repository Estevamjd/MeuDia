import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dietaService } from '@meudia/api';
import { format } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { colors } from '../../lib/colors';

export default function DietaScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const hoje = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const { data: refeicoes, refetch, isLoading } = useQuery({
    queryKey: ['refeicoes', user?.id, hoje],
    queryFn: () => dietaService.refeicoesDoDia(user!.id, hoje),
    enabled: !!user?.id && !!hoje,
  });

  const { data: agua } = useQuery({
    queryKey: ['agua', user?.id, hoje],
    queryFn: () => dietaService.aguaHoje(user!.id, hoje),
    enabled: !!user?.id && !!hoje,
  });

  const registrarAgua = useMutation({
    mutationFn: () =>
      dietaService.registrarAgua(user!.id, hoje),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agua', user?.id, hoje] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const aguaTotal = (agua as { total?: number })?.total ?? 0;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Dieta" subtitle={hoje} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
        {/* Água */}
        <Card>
          <Text style={styles.sectionTitle}>💧 Água</Text>
          <View style={styles.aguaRow}>
            <View>
              <Text style={styles.aguaValue}>{aguaTotal}ml</Text>
              <Text style={styles.aguaMeta}>Meta: 2000ml</Text>
            </View>
            <TouchableOpacity
              style={styles.aguaButton}
              onPress={() => registrarAgua.mutate()}
              activeOpacity={0.7}
            >
              <Text style={styles.aguaButtonText}>+250ml</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min((aguaTotal / 2000) * 100, 100)}%` }]} />
          </View>
        </Card>

        {/* Refeições */}
        <Text style={styles.sectionHeader}>🍽️ Refeições</Text>

        {isLoading && (
          <Card><Text style={styles.loadingText}>Carregando...</Text></Card>
        )}

        {!isLoading && (!refeicoes || (refeicoes as unknown[]).length === 0) && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhuma refeição registrada</Text>
            <Text style={styles.emptySubtitle}>Registre suas refeições do dia</Text>
          </Card>
        )}

        {(refeicoes as { id: string; nome: string; calorias?: number; horario?: string }[] | undefined)?.map(
          (refeicao) => (
            <Card key={refeicao.id}>
              <View style={styles.refeicaoRow}>
                <View>
                  <Text style={styles.refeicaoNome}>{refeicao.nome}</Text>
                  {refeicao.horario && (
                    <Text style={styles.refeicaoHorario}>{refeicao.horario}</Text>
                  )}
                </View>
                {refeicao.calorias && (
                  <Text style={styles.refeicaoCal}>{refeicao.calorias} kcal</Text>
                )}
              </View>
            </Card>
          )
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.muted, marginBottom: 12 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
  aguaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  aguaValue: { fontSize: 24, fontWeight: '800', color: colors.accent3 },
  aguaMeta: { fontSize: 12, color: colors.muted },
  aguaButton: {
    backgroundColor: 'rgba(106,255,218,0.14)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(106,255,218,0.3)',
  },
  aguaButtonText: { color: colors.accent3, fontWeight: '600', fontSize: 14 },
  progressBar: { height: 6, backgroundColor: colors.card2, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent3, borderRadius: 3 },
  loadingText: { color: colors.muted, textAlign: 'center' },
  emptyCard: { alignItems: 'center', paddingVertical: 24 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.muted, marginTop: 4 },
  refeicaoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  refeicaoNome: { fontSize: 15, fontWeight: '500', color: colors.text },
  refeicaoHorario: { fontSize: 12, color: colors.muted, marginTop: 2 },
  refeicaoCal: { fontSize: 14, fontWeight: '600', color: colors.orange },
});
