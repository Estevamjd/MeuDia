import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { agendaService } from '@meudia/api';
import { useAuth } from '../../../hooks/useAuth';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import { colors } from '../../../lib/colors';

export default function AgendaScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: compromissos, refetch, isLoading } = useQuery({
    queryKey: ['compromissos', user?.id],
    queryFn: () => agendaService.listarCompromissos(user!.id),
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
        title="Agenda"
        subtitle={`${compromissos?.length ?? 0} compromissos`}
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

        {!isLoading && (!compromissos || compromissos.length === 0) && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyTitle}>Nenhum compromisso</Text>
            <Text style={styles.emptySubtitle}>Adicione compromissos para organizar sua agenda</Text>
          </Card>
        )}

        {compromissos?.map((item) => (
          <TouchableOpacity key={item.id} activeOpacity={0.7}>
            <Card>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{item.titulo}</Text>
                <Text style={styles.itemMeta}>
                  {new Date(item.data_inicio).toLocaleDateString('pt-BR')}
                </Text>
              </View>
              {item.descricao && (
                <Text style={styles.itemDesc}>{item.descricao}</Text>
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
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 },
  itemMeta: { fontSize: 12, color: colors.muted },
  itemDesc: { fontSize: 13, color: colors.muted, marginTop: 6 },
});
