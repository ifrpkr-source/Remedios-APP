import { router, useLocalSearchParams } from 'expo-router';
import { useApp, useLoad } from '@/state/AppProvider';
import { Loading, Screen } from '@/ui/components';
import { MedicationForm } from '@/ui/MedicationForm';
import type { MedicationInput } from '@/domain/types';

export default function EditarMedicamento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repos, refresh } = useApp();
  const { data: plan } = useLoad(({ repos: r }) => r.medications.plan(id), [id]);

  if (!plan) return <Screen><Loading /></Screen>;
  const v = plan.versions[plan.versions.length - 1]!;
  const m = plan.medication;
  const initial: MedicationInput = {
    name: m.name,
    strength: m.strength,
    form: m.form,
    unitLabel: m.unitLabel,
    notes: m.notes,
    times: v.times,
    daysOfWeek: v.daysOfWeek,
    startDate: v.startDate,
    endDate: v.endDate,
    restockLeadDays: m.restockLeadDays,
    initialStock: null,
  };

  return (
    <Screen edges={['bottom']}>
      <MedicationForm
        key={plan.medication.updatedAt}
        mode="edit"
        initial={initial}
        today={repos.clock.today()}
        onSubmit={async (input) => {
          try {
            await repos.medications.update(id, input);
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
