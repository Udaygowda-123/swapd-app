import * as Location from 'expo-location';
import { router } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Field, T } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/lib/shared';
import { useToast } from '@/lib/toast';
import { colors, fonts, radius } from '@/theme/tokens';

const INTERESTS = ['Streetwear', 'Sneakers', 'Vintage', 'Gadgets', 'Gaming', 'Music', 'Photography', 'Books', 'Anime', 'Fitness', 'Sustainable fashion', 'Home & decor'];
const toggle = <V,>(list: V[], v: V) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Same three steps as the web onboarding: interests → wanted categories → approximate location. */
export default function Onboarding() {
  const insets = useSafeAreaInsets(); const { user, reload } = useAuth(); const toast = useToast();
  const [step, setStep] = useState(0); const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState(''); const [interests, setInterests] = useState<string[]>([]); const [wanted, setWanted] = useState<Category[]>([]);
  const [city, setCity] = useState(user?.locationCity ?? ''); const [region, setRegion] = useState(user?.locationRegion ?? '');
  const [consent, setConsent] = useState(false); const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null); const [locating, setLocating] = useState(false);

  async function detect() {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) { toast.error('Location permission was denied'); return; }
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
      const [place] = await Location.reverseGeocodeAsync(p.coords).catch(() => []);
      if (place) { if (!city && place.city) setCity(place.city); if (!region && place.region) setRegion(place.region); }
      toast.success('Approximate location captured');
    } catch { toast.error("Couldn't get your location"); } finally { setLocating(false); }
  }

  async function finish(skip = false) {
    setSaving(true);
    try {
      await api('/users/me', { method: 'PATCH', body: skip ? { completeOnboarding: true } : {
        bio: bio.trim() || null, interests, wantedCategories: wanted, locationCity: city.trim() || null, locationRegion: region.trim() || null,
        locationConsent: consent, ...(consent && coords ? { locationLat: coords.lat, locationLng: coords.lng } : {}), completeOnboarding: true,
      } });
      await reload(); router.replace('/');
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not save. Try again.'); } finally { setSaving(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 140, gap: 18 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 8 }}>
          <T v="label" color={colors.muted}>Step {step + 1} of 3</T>
          <View style={{ flexDirection: 'row', gap: 6 }}>{[0, 1, 2].map((i) => <View key={i} style={[s.progress, i <= step && { backgroundColor: colors.coral }]} />)}</View>
        </View>

        {step === 0 ? (
          <>
            <T v="display">Hey {user?.displayName.split(' ')[0] ?? 'there'} 👋</T>
            <T color={colors.muted}>What are you into? We use this to tune your feed. You can change it any time.</T>
            <View style={s.wrap}>{INTERESTS.map((i) => <Chip key={i} label={i} active={interests.includes(i)} onPress={() => setInterests(toggle(interests, i))} />)}</View>
            <Field label="Short bio (optional)" multiline maxLength={300} value={bio} onChangeText={setBio} />
          </>
        ) : step === 1 ? (
          <>
            <T v="display">What are you hoping to <T v="accent" color={colors.cobaltInk}>find?</T></T>
            <T color={colors.muted}>Pick the categories you&apos;d love to swap into.</T>
            <View style={s.wrap}>{CATEGORIES.map((c) => <Chip key={c} label={CATEGORY_LABELS[c]} active={wanted.includes(c)} onPress={() => setWanted(toggle(wanted, c))} />)}</View>
          </>
        ) : (
          <>
            <T v="display">Where are <T v="accent" color={colors.cobaltInk}>you?</T></T>
            <T color={colors.muted}>Only your city is ever shown to others — never an address. Sharing is optional.</T>
            <Field label="City" value={city} onChangeText={setCity} autoCapitalize="words" textContentType="addressCity" />
            <Field label="State / region" value={region} onChangeText={setRegion} autoCapitalize="words" textContentType="addressState" />
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)} style={[s.consent, consent && { borderColor: colors.ink }]}>
              <View style={[s.box, consent && s.boxOn]}>{consent ? <T style={{ color: colors.paper, fontFamily: fonts.bold, fontSize: 13 }}>✓</T> : null}</View>
              <View style={{ flex: 1 }}><T v="strong">Use my approximate location to rank nearby items</T><T v="small" color={colors.muted}>Stored rounded to about 10 km. You can turn this off any time.</T></View>
            </Pressable>
            {consent ? <Button title={coords ? 'Update location' : 'Detect location'} variant="soft" size="sm" loading={locating} icon={<MapPin size={16} color={colors.ink} />} onPress={detect} style={{ alignSelf: 'flex-start' }} /> : null}
          </>
        )}
      </ScrollView>
      <View style={[s.bar, { paddingBottom: insets.bottom + 12 }]}>
        <Button title="Skip for now" variant="ghost" disabled={saving} onPress={() => finish(true)} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {step > 0 ? <Button title="Back" variant="outline" onPress={() => setStep(step - 1)} /> : null}
          {step < 2 ? <Button title="Next" onPress={() => setStep(step + 1)} /> : <Button title="Finish" loading={saving} onPress={() => finish()} />}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  progress: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.line },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  consent: { flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: radius.card, padding: 16 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(250,248,245,0.97)', borderTopWidth: 1, borderTopColor: colors.line },
});
