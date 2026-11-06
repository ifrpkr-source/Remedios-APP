import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DoseStatus } from '@/domain/doseState';
import { STATUS_LABEL } from '@/domain/doseState';
import { WEEKDAY_SHORT, WEEKDAY_LONG } from '@/domain/time';
import { colors, radius, space, TOUCH, type } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true, edges = ['top'] }: { children: ReactNode; scroll?: boolean; edges?: ('top' | 'bottom')[] }) {
  return (
    <SafeAreaView style={s.screen} edges={edges}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={s.scrollContent}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children, ...p }: TextProps) {
  return (
    <Text accessibilityRole="header" style={[type.title, { color: colors.foreground }]} {...p}>
      {children}
    </Text>
  );
}

export function Heading({ children, ...p }: TextProps) {
  return (
    <Text accessibilityRole="header" style={[type.heading, { color: colors.foreground }]} {...p}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, bold, style, ...p }: TextProps & { muted?: boolean; bold?: boolean }) {
  return (
    <Text style={[bold ? type.bodyBold : type.body, { color: muted ? colors.muted : colors.foreground }, style]} {...p}>
      {children}
    </Text>
  );
}

export function Small({ children, style, ...p }: TextProps) {
  return (
    <Text style={[type.small, { color: colors.muted }, style]} {...p}>
      {children}
    </Text>
  );
}

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  style?: ViewStyle;
}) {
  const solid = variant === 'primary' || variant === 'accent' || variant === 'danger';
  const bg = { primary: colors.primary, accent: colors.accent, danger: colors.danger, secondary: colors.card, ghost: 'transparent' }[variant];
  const fg = solid ? colors.onSolid : variant === 'secondary' ? colors.primary : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'secondary' && { borderWidth: 2, borderColor: colors.primary },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={24} color={fg} /> : null}
      <Text style={[type.button, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Row({ children, gap = space.sm, wrap, style }: { children: ReactNode; gap?: number; wrap?: boolean; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', gap, alignItems: 'center', flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Gap({ size = space.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
}

const STATUS_ICON: Record<DoseStatus, IconName> = {
  taken: 'checkmark-circle',
  skipped: 'close-circle',
  unconfirmed: 'help-circle',
  snoozed: 'alarm',
  due: 'notifications',
  pending: 'time-outline',
  conflict: 'warning',
};

export function StatusBadge({ status }: { status: DoseStatus }) {
  const c = colors.status[status];
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]} accessibilityLabel={`Situação: ${STATUS_LABEL[status]}`}>
      <Ionicons name={STATUS_ICON[status]} size={20} color={c.fg} />
      <Text style={[type.small, { color: c.fg, fontFamily: type.bodyBold.fontFamily }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

export function Notice({ tone = 'info', icon = 'information-circle', children }: { tone?: 'info' | 'warn' | 'ok'; icon?: IconName; children: ReactNode }) {
  const c = tone === 'warn' ? colors.status.unconfirmed : tone === 'ok' ? colors.status.taken : colors.status.due;
  return (
    <View style={[s.notice, { backgroundColor: c.bg }]} accessibilityRole="text">
      <Ionicons name={icon} size={24} color={c.fg} />
      <Text style={[type.small, { color: c.fg, flex: 1 }]}>{children}</Text>
    </View>
  );
}

export function Field({
  label,
  error,
  hint,
  ...input
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type.bodyBold, { color: colors.foreground }]}>{label}</Text>
      {hint ? <Small>{hint}</Small> : null}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.muted}
        style={[s.input, error ? { borderColor: colors.danger } : null]}
        {...input}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, accessibilityLabel }: { label: string; selected: boolean; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={[s.chip, selected ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}
    >
      <Text style={[type.bodyBold, { color: selected ? colors.onSolid : colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

export function DayPicker({ value, onChange, error }: { value: number[]; onChange: (v: number[]) => void; error?: string }) {
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  const all = value.length === 7;
  return (
    <View style={{ gap: space.sm }}>
      <Text style={[type.bodyBold, { color: colors.foreground }]}>Dias da semana</Text>
      <Row wrap>
        {WEEKDAY_SHORT.map((d, i) => (
          <Chip key={d} label={d} accessibilityLabel={WEEKDAY_LONG[i]} selected={value.includes(i)} onPress={() => toggle(i)} />
        ))}
      </Row>
      <Pressable accessibilityRole="button" onPress={() => onChange(all ? [] : [0, 1, 2, 3, 4, 5, 6])} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={[type.bodyBold, { color: colors.primary }]}>{all ? 'Limpar dias' : 'Todos os dias'}</Text>
      </Pressable>
      {error ? <Text style={[type.small, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

/** Controle −/+ para quantidade por tomada (passo de meia unidade). */
export function Stepper({ value, onChange, label, step = 0.5, min = 0.5 }: { value: number; onChange: (v: number) => void; label: string; step?: number; min?: number }) {
  const fmt = (n: number) => String(n).replace('.', ',');
  return (
    <Row gap={space.sm} style={{ flexShrink: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Diminuir ${label}`}
        onPress={() => onChange(Math.max(min, value - step))}
        style={s.stepBtn}
      >
        <Ionicons name="remove" size={24} color={colors.primary} />
      </Pressable>
      <Text accessibilityLabel={`${label}: ${fmt(value)}`} style={[type.heading, { minWidth: 44, textAlign: 'center', color: colors.foreground }]}>
        {fmt(value)}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Aumentar ${label}`} onPress={() => onChange(value + step)} style={s.stepBtn}>
        <Ionicons name="add" size={24} color={colors.primary} />
      </Pressable>
    </Row>
  );
}

export function Loading() {
  return (
    <View style={{ padding: space.xxl, alignItems: 'center' }}>
      <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Carregando" />
    </View>
  );
}

export function ListLink({ label, detail, icon, onPress }: { label: string; detail?: string; icon?: IconName; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={detail ? `${label}. ${detail}` : label} onPress={onPress} style={({ pressed }) => [s.listLink, pressed && { opacity: 0.8 }]}>
      {icon ? <Ionicons name={icon} size={26} color={colors.primary} /> : null}
      <View style={{ flex: 1 }}>
        <Body bold>{label}</Body>
        {detail ? <Small>{detail}</Small> : null}
      </View>
      <Ionicons name="chevron-forward" size={24} color={colors.muted} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: space.lg, paddingBottom: space.xxl * 2, gap: space.lg },
  button: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, alignSelf: 'flex-start' },
  notice: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md, alignItems: 'flex-start' },
  input: {
    minHeight: TOUCH,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: colors.card,
    ...type.body,
    color: colors.foreground,
  },
  chip: { minHeight: 48, minWidth: 56, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  stepBtn: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  listLink: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH + 8, paddingVertical: space.sm },
});
