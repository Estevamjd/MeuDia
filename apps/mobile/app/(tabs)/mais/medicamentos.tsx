import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { medicamentosService } from '@meudia/api';
import { useAuth } from '../../../hooks/useAuth';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import { colors } from '../../../lib/colors';

export default function MedicamentosScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: medicamentos, refetch, isLoading } = useQuery({
    queryKey: ['medicamentos', user?.id],
    queryFn: () => medicamentosService.listarMedicamentos(user!.id),
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
        title="Medicamentos"
        subtitle={`${medicamentos?.length ?? 0} medicamentos`}
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

        {!isLoading && (!medicamentos || medicamentos.length === 0) && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>💊</Text>
            <Text style={styles.emptyTitle}>Nenhum medicamento</Text>
            <Text style={styles.emptySubtitle}>Adicione medicamentos para controlar seus horários</Text>
          </Card>
        )}

        {medicamentos?.map((med: { id: string; nome: string; dosagem?: string; horario?: string; frequencia?: string }) => (
          <TouchableOpacity key={med.id} activeOpacity={0.7}>
            <Card>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{med.nome}</Text>
                {med.horario && (
                  <Text style={styles.itemMeta}>{med.horario}</Text>
                )}
              </View>
              <View style={styles.itemDetails}>
                {med.dosagem && <Text style={styles.itemDesc}>{med.dosagem}</Text>}
                {med.frequencia && <Text style={styles.itemDesc}>{med.frequencia}</Text>}
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
  itemMeta: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  itemDetails: { flexDirection: 'row', gap: 12, marginTop: 4 },
  itemDesc: { fontSize: 13, color: colors.muted },
});
