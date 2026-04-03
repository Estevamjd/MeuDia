import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { colors } from '../../../lib/colors';

interface MenuItem {
  label: string;
  icon: string;
  description: string;
  route: string;
}

const menuItems: MenuItem[] = [
  { label: 'Agenda', icon: '📅', description: 'Compromissos e eventos', route: '/(tabs)/mais/agenda' },
  { label: 'Finanças', icon: '💰', description: 'Receitas e despesas', route: '/(tabs)/mais/financas' },
  { label: 'Compras', icon: '🛒', description: 'Listas de compras', route: '/(tabs)/mais/compras' },
  { label: 'Assinaturas', icon: '💳', description: 'Serviços recorrentes', route: '/(tabs)/mais/assinaturas' },
  { label: 'Veículo', icon: '🚗', description: 'Manutenção e gastos', route: '/(tabs)/mais/veiculo' },
];

export default function MaisScreen() {
  const { signOut } = useAuth();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScreenHeader title="Mais" subtitle="Outros módulos" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.label}
            activeOpacity={0.7}
            onPress={() => router.push(item.route as any)}
          >
            <Card style={styles.menuItem}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <View style={styles.menuInfo}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuDesc}>{item.description}</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </Card>
          </TouchableOpacity>
        ))}

        {/* Configurações */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Conta</Text>
          <Card>
            <TouchableOpacity
              style={styles.configItem}
              onPress={() => router.push('/(tabs)/mais/perfil' as any)}
            >
              <Text style={styles.configIcon}>👤</Text>
              <Text style={styles.configLabel}>Perfil</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          </Card>

          <Button
            title="Sair da conta"
            variant="danger"
            onPress={signOut}
            style={styles.signOutBtn}
          />
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 10 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuIcon: { fontSize: 28 },
  menuInfo: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  menuDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  menuArrow: { fontSize: 22, color: colors.muted, fontWeight: '300' },
  section: { marginTop: 16, gap: 10 },
  sectionHeader: { fontSize: 14, fontWeight: '700', color: colors.muted, marginBottom: 4 },
  configItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  configIcon: { fontSize: 20 },
  configLabel: { flex: 1, fontSize: 15, color: colors.text },
  signOutBtn: { marginTop: 8 },
});
