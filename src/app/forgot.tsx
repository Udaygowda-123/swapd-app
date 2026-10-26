import { Link } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { AuthScreen, FormError } from '@/components/auth-screen';
import { Button, Field, T } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { colors } from '@/theme/tokens';

export default function Forgot() {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false); const [error, setError] = useState<string>();

  async function submit() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter the email you signed up with.');
    setBusy(true); setError(undefined);
    try { await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } }); setSent(true); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not send the email. Try again.'); }
    finally { setBusy(false); }
  }

  if (sent) return (
    <AuthScreen title="Check your" accent="inbox">
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 12 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' }}><MailCheck size={30} color={colors.mintInk} /></View>
        <T style={{ textAlign: 'center' }}>If an account exists for <T v="strong">{email.trim()}</T>, we&apos;ve sent a link to reset your password. Open it on this phone or any browser.</T>
      </View>
      <Link href="/login" replace asChild><Button title="Back to sign in" variant="outline" /></Link>
    </AuthScreen>
  );

  return (
    <AuthScreen title="Reset your" accent="password" subtitle="We'll email you a secure link.">
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" returnKeyType="send" onSubmitEditing={submit} />
      <FormError message={error} />
      <Button title="Send reset link" size="lg" loading={busy} onPress={submit} />
      <Link href="/login" replace style={{ alignSelf: 'center' }}><T v="strong" style={{ textDecorationLine: 'underline' }}>Back to sign in</T></Link>
    </AuthScreen>
  );
}
