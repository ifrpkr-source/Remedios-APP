import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold, useFonts } from '@expo-google-fonts/atkinson-hyperlegible';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AlarmsProvider } from '@/state/AlarmsProvider';
import { AppProvider } from '@/state/AppProvider';
import { colors, fonts } from '@/ui/theme';

// Erros de renderização mostram uma tela de recuperação em vez de fechar o app.
export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  const [loaded, error] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
  // Sem a fonte (ex.: erro de carregamento), o app segue com a fonte do sistema.
  if (!loaded && !error) return null;

  return (
    <AppProvider>
      <AlarmsProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontFamily: fonts.bold, fontSize: 20, color: colors.foreground },
          headerBackTitle: 'Voltar',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="medicamento/novo" options={{ title: 'Novo medicamento', presentation: 'modal' }} />
        <Stack.Screen name="medicamento/[id]" options={{ title: 'Medicamento' }} />
        <Stack.Screen name="medicamento/editar/[id]" options={{ title: 'Editar medicamento' }} />
        <Stack.Screen name="historico" options={{ title: 'Histórico' }} />
        <Stack.Screen name="dose/[key]" options={{ title: 'Dose' }} />
      </Stack>
      </AlarmsProvider>
    </AppProvider>
  );
}
