import { router } from 'expo-router';
import { useApp } from '@/state/AppProvider';
import { MedicationForm } from '@/ui/MedicationForm';
import { Screen } from '@/ui/components';

export default function NovoMedicamento() {
  const { repos, refresh } = useApp();
  return (
    <Screen edges={['bottom']}>
      <MedicationForm
        mode="create"
        today={repos.clock.today()}
        onSubmit={async (input) => {
          try {
            await repos.medications.create(input);
            await repos.settings.setOnboardingDone();
            refresh();
            router.back();
            return null;
          } catch (e) {
            return e as Error;
          }
        }}
      />
    </Screen>
  );
}
