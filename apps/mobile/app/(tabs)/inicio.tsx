import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../hooks/useAuth';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { colors } from '../../lib/colors';
import { useQueryClient } from '@tanstack/react-query';

export default function InicioScreen() {
  const { user, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const hoje = useMemo(() => new Date(), []);
  const dataFormatada = format(hoje, "EEEE, d 'de' MMMM", { locale: ptBR });

  const userName = (user?.user_metadata?.nome as string) || user?.email?.split('@')[0] || 'Usuário';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }, [queryClient]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Meu Dia"
        subtitle={dataFormatada}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Saudação */}
        <Card>
          <Text style={styles.greeting}>
            Olá, <Text style={styles.accentText}>{userName}</Text> 👋
          </Text>
          <Text style={styles.greetingSubtitle}>
            Como está seu dia hoje?
          </Text>
        </Card>

        {/* Score do dia */}
        <Card style={styles.scoreCard}>
          <Text style={styles.sectionTitle}>Score do dia</Text>
          <View style={styles.scoreContainer}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreValue}>0</Text>
              <Text style={styles.scoreLabel}>pts</Text>
            </View>
          </View>
        </Card>

        {/* Resumo rápido */}
        <Text style={styles.sectionHeader}>Resumo</Text>

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statEmoji}>💪</Text>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Treinos</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statEmoji}>✅</Text>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Hábitos</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statEmoji}>💧</Text>
            <Text style={styles.statValue}>0ml</Text>
            <Text style={styles.statLabel}>Água</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </Card>
        </View>

        {/* Sair */}
        <Button
          title="Sair da conta"
          variant="ghost"
          onPress={signOut}
          style={styles.signOutBtn}
        />

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  accentText: {
    color: colors.accent,
  },
  greetingSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  scoreCard: {
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  scoreLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    alignItems: 'center',
    gap: 4,
  },
  statEmoji: {
    fontSize: 24,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  signOutBtn: {
    marginTop: 16,
  },
});
