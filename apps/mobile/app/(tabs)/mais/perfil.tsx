import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { profileService } from '@meudia/api';
import { useAuth } from '../../../hooks/useAuth';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import { colors } from '../../../lib/colors';

export default function PerfilScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: perfil, refetch, isLoading } = useQuery({
    queryKey: ['perfil', user?.id],
    queryFn: () => profileService.obterPerfil(user!.id),
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
        title="Perfil"
        subtitle="Suas informações"
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

        {!isLoading && !perfil && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>👤</Text>
            <Text style={styles.emptyTitle}>Perfil não encontrado</Text>
            <Text style={styles.emptySubtitle}>Complete seu perfil para personalizar sua experiência</Text>
          </Card>
        )}

        {perfil && (
          <>
            <Card style={styles.avatarCard}>
              <Text style={styles.avatarEmoji}>👤</Text>
              <Text style={styles.userName}>{perfil.nome ?? user?.email ?? 'Usuário'}</Text>
              {user?.email && <Text style={styles.userEmail}>{user.email}</Text>}
            </Card>

            <Card>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nome</Text>
                <Text style={styles.infoValue}>{perfil.nome ?? '-'}</Text>
              </View>
            </Card>

            {perfil.peso_atual && (
              <Card>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Peso atual</Text>
                  <Text style={styles.infoValue}>{perfil.peso_atual} kg</Text>
                </View>
              </Card>
            )}

            {perfil.altura && (
              <Card>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Altura</Text>
                  <Text style={styles.infoValue}>{perfil.altura} cm</Text>
                </View>
              </Card>
            )}

            {perfil.objetivo && (
              <Card>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Objetivo</Text>
                  <Text style={styles.infoValue}>{perfil.objetivo}</Text>
                </View>
              </Card>
            )}
          </>
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
  loadingText: { color: colors.muted, textAlign: 'center' },
  emptyCard: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.muted, marginTop: 4 },
  avatarCard: { alignItems: 'center', paddingVertical: 24 },
  avatarEmoji: { fontSize: 56, marginBottom: 12 },
  userName: { fontSize: 20, fontWeight: '700', color: colors.text },
  userEmail: { fontSize: 13, color: colors.muted, marginTop: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 14, color: colors.muted },
  infoValue: { fontSize: 15, fontWeight: '600', color: colors.text },
});
