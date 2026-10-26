import { Link } from 'expo-router';
import { useState } from 'react';
import { AuthScreen, enterApp, FormError } from '@/components/auth-screen';
import { Button, Field, T } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme/tokens';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string>(); const [fields, setFields] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    const local: Record<string, string> = {};
    if (form.displayName.trim().length < 2) local.displayName = 'Use at least 2 characters';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) local.email = 'Enter a valid email';
    if (form.password.length < 10) local.password = 'Use at least 10 characters';
    setFields(local); setError(undefined);
    if (Object.keys(local).length) return;
    setBusy(true);
    try { await register(form.displayName.trim(), form.email.trim(), form.password); enterApp(); }
    catch (e) { if (e instanceof ApiError) { setFields(e.fieldErrors()); setError(e.details?.length ? undefined : e.message); } else setError('Could not create your account. Try again.'); }
    finally { setBusy(false); }
  }

  return (
    <AuthScreen title="Start" accent="swapping" subtitle="Free to join. List what you don't use, find what you love.">
      <Field label="Your name" value={form.displayName} onChangeText={set('displayName')} autoComplete="name" textContentType="name" error={fields.displayName} />
      <Field label="Email" value={form.email} onChangeText={set('email')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" error={fields.email} />
      <Field label="Password" value={form.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint="At least 10 characters." error={fields.password} />
      <FormError message={error} />
      <Button title="Create account" size="lg" loading={busy} onPress={submit} />
      <Link href="/login" replace style={{ alignSelf: 'center', marginTop: 4 }}><T v="strong" style={{ textDecorationLine: 'underline' }}>I already have an account</T></Link>
      <T v="small" color={colors.muted}>We&apos;ll email you a link to verify your address. SWAPD never handles payments.</T>
    </AuthScreen>
  );
}
