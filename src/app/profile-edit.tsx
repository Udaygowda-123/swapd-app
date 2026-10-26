import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, BackHeader, Button, Chip, Field, Loading, T } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/lib/shared';
import type { Me } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { uploadPhoto } from '@/lib/upload';
import { colors, fonts, radius } from '@/theme/tokens';

/** Edit profile (same fields as the web dialog): photo, name, bio, city/region, wanted categories, location consent. */
export default function ProfileEdit() {
  const { user } = useAuth();
  // The form starts from the signed-in account, so wait until it has loaded (e.g. when this screen is opened from a deep link).
  return user ? <ProfileForm user={user} /> : <Loading />;
}

function ProfileForm({ user }: { user: Me }) {
  const insets = useSafeAreaInsets(); const { reload } = useAuth(); const qc = useQueryClient(); const toast = useToast();
  const [f, setF] = useState(() => ({
    displayName: user.displayName, bio: user.bio ?? '', city: user.locationCity ?? '', region: user.locationRegion ?? '',
    wanted: (user.preference?.wantedCategories ?? []) as Category[], consent: user.preference?.locationConsent ?? false, avatarUrl: user.avatarUrl ?? '',
  }));
  const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [error, setError] = useState<string>();

  async function changePhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast.error('Allow photo access in Settings to change your picture.');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (res.canceled) return;
    setUploading(true);
    try { const img = await uploadPhoto(res.assets[0].uri, res.assets[0].width); setF((x) => ({ ...x, avatarUrl: img.thumbUrl ?? img.url })); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Upload failed'); } finally { setUploading(false); }
  }

  async function save() {
    setBusy(true); setError(undefined);
    try {
      await api('/users/me', { method: 'PATCH', body: { displayName: f.displayName.trim(), bio: f.bio.trim() || null, locationCity: f.city.trim() || null, locationRegion: f.region.trim() || null, wantedCategories: f.wanted, locationConsent: f.consent, avatarUrl: f.avatarUrl || null } });
      await reload(); qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Profile updated'); if (router.canGoBack()) router.back(); else router.replace('/me');
    } catch (e) { setError(e instanceof ApiError ? (Object.values(e.fieldErrors())[0] ?? e.message) : 'Could not save'); } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: Platform.OS === 'ios' ? 8 : insets.top }}><BackHeader label="Cancel" fallback="/me" /></View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 18, paddingBottom: 120 + insets.bottom }} keyboardShouldPersistTaps="handled">
        <T v="display">Edit <T v="accent" color={colors.cobaltInk}>profile</T></T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Change photo" onPress={changePhoto}>
            <Avatar name={f.displayName || user.displayName} url={f.avatarUrl || null} size={84} />
            <View style={s.cam}>{uploading ? <ActivityIndicator size="small" color={colors.paper} /> : <Camera size={14} color={colors.paper} />}</View>
          </Pressable>
          <View style={{ gap: 8 }}>
            <Button title="Change photo" size="sm" variant="outline" onPress={changePhoto} loading={uploading} />
            {f.avatarUrl ? <Button title="Remove" size="sm" variant="ghost" onPress={() => setF({ ...f, avatarUrl: '' })} /> : null}
          </View>
        </View>
        <Field label="Display name" value={f.displayName} onChangeText={(t) => setF({ ...f, displayName: t })} maxLength={40} />
        <Field label="Bio" value={f.bio} onChangeText={(t) => setF({ ...f, bio: t })} maxLength={300} multiline />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}><Field label="City" value={f.city} onChangeText={(t) => setF({ ...f, city: t })} autoCapitalize="words" /></View>
          <View style={{ flex: 1 }}><Field label="State / region" value={f.region} onChangeText={(t) => setF({ ...f, region: t })} autoCapitalize="words" /></View>
        </View>
        <T v="strong">Categories you want</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{CATEGORIES.map((c) => { const on = f.wanted.includes(c); return <Chip key={c} label={CATEGORY_LABELS[c]} active={on} onPress={() => setF({ ...f, wanted: on ? f.wanted.filter((x) => x !== c) : [...f.wanted, c] })} />; })}</View>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: f.consent }} onPress={() => setF({ ...f, consent: !f.consent })} style={[s.consent, f.consent && { borderColor: colors.ink }]}>
          <View style={{ flex: 1 }}><T v="strong">Use approximate location for ranking</T><T v="small" color={colors.muted}>Turning this off deletes stored coordinates.</T></View>
          <View style={[s.switch, f.consent && { backgroundColor: colors.ink }]}><View style={[s.knob, f.consent && { transform: [{ translateX: 20 }] }]} /></View>
        </Pressable>
        {error ? <View accessibilityRole="alert" style={s.err}><T v="small" color={colors.danger} style={{ fontFamily: fonts.semibold }}>{error}</T></View> : null}
      </ScrollView>
      <View style={[s.bar, { paddingBottom: insets.bottom + 12 }]}>
        <Button title="Save" size="lg" loading={busy} disabled={f.displayName.trim().length < 2 || uploading} onPress={save} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  cam: { position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.paper },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: radius.card, padding: 16 },
  switch: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.line, padding: 4 },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface },
  err: { backgroundColor: colors.dangerSoft, borderRadius: 14, padding: 14 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(250,248,245,0.97)', borderTopWidth: 1, borderTopColor: colors.line },
});
