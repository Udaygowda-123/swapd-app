import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Field, T } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { colors, fonts } from '@/theme/tokens';

const REASONS = ['Prohibited or illegal item', 'Scam or suspicious', 'Counterfeit', 'Harassment or abuse', 'Misleading photos or description', 'Other'];

/** Same reasons and endpoint as the web report dialog. */
export function ReportSheet({ open, onClose, targetType, targetId, subject }: { open: boolean; onClose: () => void; targetType: 'LISTING' | 'USER' | 'MESSAGE'; targetId: string; subject: string }) {
  const [reason, setReason] = useState(REASONS[0]); const [details, setDetails] = useState(''); const [busy, setBusy] = useState(false); const toast = useToast();
  async function submit() {
    setBusy(true);
    try { await api('/reports', { method: 'POST', body: { targetType, targetId, reason, details: details.trim() || undefined } }); toast.success('Thanks — our moderators will take a look.'); setDetails(''); onClose(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not send your report'); } finally { setBusy(false); }
  }
  return (
    <Sheet open={open} onClose={onClose} title={`Report ${subject}`} description="Reports are reviewed by moderators. The other person is not told who reported them."
      footer={<><Button title="Cancel" variant="ghost" style={{ flex: 1 }} onPress={onClose} /><Button title="Send report" variant="danger" style={{ flex: 1 }} loading={busy} onPress={submit} /></>}>
      <T v="strong">What&apos;s wrong?</T>
      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        {REASONS.map((r) => (
          <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: reason === r }} onPress={() => setReason(r)} style={[s.opt, reason === r && s.on]}>
            <View style={[s.radio, reason === r && s.radioOn]} /><T style={{ fontFamily: reason === r ? fonts.semibold : fonts.body, flex: 1 }}>{r}</T>
          </Pressable>
        ))}
      </View>
      <Field label="Details (optional)" multiline maxLength={1000} value={details} onChangeText={setDetails} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13 },
  on: { borderColor: colors.ink },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.line },
  radioOn: { borderColor: colors.ink, borderWidth: 6 },
});
