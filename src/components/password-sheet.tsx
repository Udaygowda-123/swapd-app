import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Button, Field, T } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { colors, fonts } from '@/theme/tokens';

/** Change password (web dialog): signs you out everywhere afterwards. */
export function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logout } = useAuth(); const toast = useToast();
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setErr(null);
    try { await api('/auth/change-password', { method: 'POST', body: { currentPassword: cur, newPassword: next } }); toast.success('Password changed — please sign in again'); onClose(); await logout(); router.replace('/login'); }
    catch (e) { setErr(e instanceof ApiError ? (e.fieldErrors().newPassword ?? e.message) : 'Could not change password'); } finally { setBusy(false); }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Change password" description="You'll be signed out on all devices afterwards."
      footer={<><Button title="Cancel" variant="ghost" style={{ flex: 1 }} onPress={onClose} /><Button title="Change password" style={{ flex: 1.4 }} loading={busy} disabled={!cur || next.length < 10} onPress={submit} /></>}>
      <Field label="Current password" value={cur} onChangeText={setCur} secureTextEntry autoComplete="current-password" textContentType="password" />
      <Field label="New password" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint="At least 10 characters." />
      {err ? <View accessibilityRole="alert" style={{ backgroundColor: colors.dangerSoft, borderRadius: 14, padding: 14 }}><T v="small" color={colors.danger} style={{ fontFamily: fonts.semibold }}>{err}</T></View> : null}
    </Sheet>
  );
}
