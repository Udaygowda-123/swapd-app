import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';
import { AuthScreen, enterApp, FormError } from '@/components/auth-screen';
import { Button, Field, T } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme/tokens';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string>(); const pw = useRef<TextInputInstance>(null);

  async function submit() {
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true); setError(undefined);
    try { enterApp(await login(email.trim(), password)); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not sign in. Try again.'); }
    finally { setBusy(false); }
  }

  return (
    <AuthScreen title="Welcome" accent="back" subtitle="Sign in to see your offers and messages.">
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => pw.current?.focus()} />
      <Field ref={pw} label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
      <FormError message={error} />
      <Button title="Sign in" size="lg" loading={busy} onPress={submit} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Link href="/forgot" replace><T v="strong" style={{ textDecorationLine: 'underline' }}>Forgot password?</T></Link>
        <Link href="/register" replace><T v="strong" style={{ textDecorationLine: 'underline' }}>Create account</T></Link>
      </View>
      <T v="small" color={colors.muted} style={{ marginTop: 8 }}>Same account as the SWAPD website.</T>
    </AuthScreen>
  );
}
