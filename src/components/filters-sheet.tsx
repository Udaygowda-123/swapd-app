import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Chip, Field, T } from '@/components/ui';
import { CONDITION_LABELS, CONDITIONS, type Condition } from '@/lib/shared';

export interface Filters { condition: Condition | ''; minValue: string; maxValue: string; city: string }
export const NO_FILTERS: Filters = { condition: '', minValue: '', maxValue: '', city: '' };
export const activeFilterCount = (f: Filters) => (Object.keys(NO_FILTERS) as (keyof Filters)[]).filter((k) => f[k]).length;

/** Same filters as the web Discover dialog (condition, value range, city). Edits apply on "Show results". */
export function FiltersSheet({ open, value, onClose, onApply }: { open: boolean; value: Filters; onClose: () => void; onApply: (f: Filters) => void }) {
  const [f, setF] = useState(value);
  useEffect(() => { if (open) setF(value); }, [open, value]); // eslint-disable-line react-hooks/set-state-in-effect -- reset draft when reopened
  const num = (v: string) => v.replace(/\D/g, '').slice(0, 8);
  const invalid = !!f.minValue && !!f.maxValue && Number(f.minValue) > Number(f.maxValue);
  return (
    <Sheet open={open} onClose={onClose} title="Filters" description="Estimated values are set by owners and aren't appraisals."
      footer={<><Button title="Clear" variant="ghost" style={{ flex: 1 }} onPress={() => { onApply(NO_FILTERS); onClose(); }} /><Button title="Show results" style={{ flex: 1.4 }} disabled={invalid} onPress={() => { onApply({ ...f, city: f.city.trim() }); onClose(); }} /></>}>
      <T v="strong">Condition</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label="Any" active={!f.condition} onPress={() => setF({ ...f, condition: '' })} />
        {CONDITIONS.map((c) => <Chip key={c} label={CONDITION_LABELS[c]} active={f.condition === c} onPress={() => setF({ ...f, condition: c })} />)}
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}><Field label="Min value (₹)" keyboardType="number-pad" value={f.minValue} onChangeText={(v) => setF({ ...f, minValue: num(v) })} placeholder="0" /></View>
        <View style={{ flex: 1 }}><Field label="Max value (₹)" keyboardType="number-pad" value={f.maxValue} onChangeText={(v) => setF({ ...f, maxValue: num(v) })} placeholder="Any" error={invalid ? 'Must be ≥ min' : undefined} /></View>
      </View>
      <Field label="City" value={f.city} onChangeText={(v) => setF({ ...f, city: v })} placeholder="e.g. Pune" autoCapitalize="words" maxLength={80} />
    </Sheet>
  );
}
