import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import type { IconName } from '@/ui/components';
import { colors, fonts } from '@/ui/theme';

const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={String(color)} size={size + 2} />;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 14 },
        tabBarStyle: { minHeight: 68, paddingTop: 6, backgroundColor: colors.card, borderTopColor: colors.divider },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Hoje', tabBarIcon: icon('today') }} />
      <Tabs.Screen name="medicamentos" options={{ title: 'Medicamentos', tabBarIcon: icon('medkit') }} />
      <Tabs.Screen name="estoque" options={{ title: 'Estoque', tabBarIcon: icon('cube') }} />
      <Tabs.Screen name="familia" options={{ title: 'Família', tabBarIcon: icon('people') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icon('person-circle') }} />
    </Tabs>
  );
}
