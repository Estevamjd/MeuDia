import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { veiculoService } from '@meudia/api';
import { useAuth } from '../../../hooks/useAuth';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import { colors } from '../../../lib/colors';

export default function VeiculoScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: veiculos, refetch, isLoading } = useQuery({
    queryKey: ['veiculos', user?.id],
    queryFn: () => veiculoService.listarVeiculos(user!.id),
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
        title="Veículo"
        subtitle={`${veiculos?.length ?? 0} veículos`}
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

        {!isLoading && (!veiculos || veiculos.length === 0) && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🚗</Text>
            <Text style={styles.emptyTitle}>Nenhum veículo</Text>
            <Text style={styles.emptySubtitle}>Cadastre seu veículo para acompanhar manutenções e gastos</Text>
          </Card>
        )}

        {veiculos?.map((v) => (
          <TouchableOpacity key={v.id} activeOpacity={0.7}>
            <Card>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{v.modelo}</Text>
                {v.placa && <Text style={styles.itemPlaca}>{v.placa}</Text>}
              </View>
              <View style={styles.itemDetails}>
                {v.ano && <Text style={styles.itemDesc}>{v.ano}</Text>}
                <Text style={styles.itemDesc}>{v.km_atual} km</Text>
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
  itemPlaca: { fontSize: 13, fontWeight: '700', color: colors.accent, backgroundColor: colors.card2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  itemDetails: { flexDirection: 'row', gap: 12, marginTop: 4 },
  itemDesc: { fontSize: 13, color: colors.muted },
});
