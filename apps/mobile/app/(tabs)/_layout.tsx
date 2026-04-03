import { Tabs } from 'expo-router';
import { colors } from '../../lib/colors';
import { Platform } from 'react-native';

// Ícones com texto simples (podem ser trocados por @expo/vector-icons depois)
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    inicio: '🏠',
    treinos: '💪',
    habitos: '✅',
    notas: '📝',
    mais: '⚡',
  };

  const { Text } = require('react-native');
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {icons[name] || '📱'}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="inicio"
        options={{
          title: 'Início',
          tabBarIcon: ({ focused }) => <TabIcon name="inicio" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="treinos"
        options={{
          title: 'Treinos',
          tabBarIcon: ({ focused }) => <TabIcon name="treinos" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="habitos"
        options={{
          title: 'Hábitos',
          tabBarIcon: ({ focused }) => <TabIcon name="habitos" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notas"
        options={{
          title: 'Notas',
          tabBarIcon: ({ focused }) => <TabIcon name="notas" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="dieta"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="mais"
        options={{
          title: 'Mais',
          tabBarIcon: ({ focused }) => <TabIcon name="mais" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
