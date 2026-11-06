import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { isPausedNow } from '@/domain/schedule';
import { useLoad } from '@/state/AppProvider';
import { Body, Button, Card, Chip, ListLink, Loading, Row, Screen, Small, Title } from '@/ui/components';
import { scheduleSummary } from '@/ui/format';
import { space } from '@/ui/theme';

export default function Medicamentos() {
  const [showArchived, setShowArchived] = useState(false);
  const { data } = useLoad(({ repos }) => repos.medications.plans({ includeArchived: true }));

  const plans = (data ?? []).filter((p) => (showArchived ? p.medication.archivedAt !== null : p.medication.archivedAt === null));

  return (
    <Screen>
      <Title>Medicamentos</Title>
      <Button icon="add-circle" label="Cadastrar medicamento" onPress={() => router.push('/medicamento/novo')} />
      <Row>
        <Chip label="Em uso" selected={!showArchived} onPress={() => setShowArchived(false)} />
        <Chip label="Arquivados" selected={showArchived} onPress={() => setShowArchived(true)} />
      </Row>
      {!data ? (
        <Loading />
      ) : plans.length === 0 ? (
        <Card>
          <Body muted>{showArchived ? 'Nenhum medicamento arquivado.' : 'Nenhum medicamento cadastrado.'}</Body>
        </Card>
      ) : (
        <Card style={{ gap: 0 }}>
          {plans.map((p, i) => {
            const paused = isPausedNow(p.pauses);
            const latest = p.versions[p.versions.length - 1];
            const label = [p.medication.name, p.medication.strength].filter(Boolean).join(' ');
            return (
              <View key={p.medication.id} style={i > 0 ? { borderTopWidth: 1, borderTopColor: '#D5E2E7' } : undefined}>
                <ListLink
                  icon={paused ? 'pause-circle' : p.medication.archivedAt ? 'archive' : 'medkit'}
                  label={label}
                  detail={`${paused ? 'Pausado · ' : ''}${latest ? scheduleSummary(latest) : ''}`}
                  onPress={() => router.push({ pathname: '/medicamento/[id]', params: { id: p.medication.id } })}
                />
              </View>
            );
          })}
        </Card>
      )}
      <Small style={{ marginTop: space.sm }}>
        Concentração e quantidades são registradas exatamente como você informar. O app não sugere doses.
      </Small>
    </Screen>
  );
}
