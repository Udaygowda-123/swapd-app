import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, ImagePlus, Star, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORY_ICON } from '@/components/category-icons';
import { BackHeader, Button, Chip, Field, T } from '@/components/ui';
import { absUrl, api, ApiError } from '@/lib/api';
import { notify } from '@/lib/confirm';
import { CATEGORIES, CATEGORY_LABELS, CONDITION_LABELS, CONDITIONS, type CashFlexibility, type Category, type Condition, type ExchangeMethod } from '@/lib/shared';
import type { ImageDto, Listing } from '@/lib/types';
import { uploadPhoto } from '@/lib/upload';
import { colors, fonts, radius } from '@/theme/tokens';

const MAX_PHOTOS = 8;
const CASH: { v: CashFlexibility; label: string }[] = [{ v: 'NONE', label: 'Straight swaps' }, { v: 'WILL_ADD', label: 'I can add cash' }, { v: 'WILL_ACCEPT', label: 'I can receive cash' }, { v: 'EITHER', label: 'Either way' }];

export default function NewListing() {
  const insets = useSafeAreaInsets(); const qc = useQueryClient();
  const [images, setImages] = useState<ImageDto[]>([]); const [cover, setCover] = useState<string | null>(null); const [uploading, setUploading] = useState(0);
  const [f, setF] = useState({ title: '', description: '', value: '', wantedText: '' });
  const [category, setCategory] = useState<Category | null>(null); const [condition, setCondition] = useState<Condition | null>(null);
  const [cash, setCash] = useState<CashFlexibility>('NONE'); const [methods, setMethods] = useState<ExchangeMethod[]>(['LOCAL_HANDOVER']);
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  async function pick(source: 'library' | 'camera') {
    const room = MAX_PHOTOS - images.length; if (room <= 0) return notify(`You can add up to ${MAX_PHOTOS} photos`);
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return notify('Permission needed', source === 'camera' ? 'Allow camera access in Settings to take photos.' : 'Allow photo access in Settings to add pictures.');
    const res = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 1 });
    if (res.canceled) return;
    for (const a of res.assets.slice(0, room)) {
      setUploading((n) => n + 1);
      try {
        const img = await uploadPhoto(a.uri, a.width);
        setImages((cur) => [...cur, img]); setCover((c) => c ?? img.id); setErrors((e) => ({ ...e, imageIds: '' }));
      } catch (e) { notify('Could not upload a photo', e instanceof ApiError ? e.message : 'Check your connection and try again.'); }
      finally { setUploading((n) => n - 1); }
    }
  }
  function removePhoto(img: ImageDto) {
    const rest = images.filter((i) => i.id !== img.id); setImages(rest);
    if (cover === img.id) setCover(rest[0]?.id ?? null);
    api(`/media/images/${img.id}`, { method: 'DELETE' }).catch(() => undefined);
  }

  async function submit() {
    const e: Record<string, string> = {};
    if (!images.length) e.imageIds = 'Add at least one photo';
    if (f.title.trim().length < 3) e.title = 'Use at least 3 characters';
    if (f.description.trim().length < 10) e.description = 'Tell people a bit more (10+ characters)';
    if (!category) e.category = 'Pick a category';
    if (!condition) e.condition = 'Pick a condition';
    if (!methods.length) e.exchangeMethods = 'Pick at least one exchange method';
    setErrors(e); if (Object.values(e).some(Boolean)) return notify('A few things to fix', Object.values(e).filter(Boolean)[0]);
    setBusy(true);
    try {
      const value = parseInt(f.value.replace(/\D/g, ''), 10);
      const l = await api<Listing>('/listings', { method: 'POST', body: {
        title: f.title.trim(), description: f.description.trim(), category, condition, estimatedValue: Number.isFinite(value) ? value : null,
        wantedText: f.wantedText.trim() || null, wantedCategories: [], cashFlexibility: cash, exchangeMethods: methods, imageIds: images.map((i) => i.id), coverImageId: cover ?? undefined,
      } });
      qc.invalidateQueries({ queryKey: ['user-listings'] }); qc.invalidateQueries({ queryKey: ['discover'] });
      router.replace(`/listing/${l.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) setErrors(err.fieldErrors());
      notify('Could not publish', err instanceof ApiError ? err.message : 'Check your connection and try again.');
    } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: Platform.OS === 'ios' ? 8 : insets.top }}><BackHeader label="Cancel" /></View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 22, paddingBottom: 120 + insets.bottom }} keyboardShouldPersistTaps="handled">
        <View><T v="display">List an <T v="accent" color={colors.cobaltInk}>item</T></T><T color={colors.muted}>Add photos, tell people what it is, and what you&apos;d swap it for.</T></View>

        <View style={{ gap: 10 }}>
          <T v="heading">Photos <T color={colors.muted}>({images.length}/{MAX_PHOTOS})</T></T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {images.map((img) => (
              <View key={img.id} style={s.photo}>
                <Pressable accessibilityRole="button" accessibilityLabel="Use as cover photo" onPress={() => setCover(img.id)} style={StyleSheet.absoluteFill}>
                  <Image source={absUrl(img.thumbUrl ?? img.url)} style={StyleSheet.absoluteFill} contentFit="cover" />
                </Pressable>
                {cover === img.id ? <View style={s.cover}><Star size={10} color={colors.ink} fill={colors.ink} /><T v="small" style={{ fontSize: 10, fontFamily: fonts.bold }}>Cover</T></View> : null}
                <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" hitSlop={6} onPress={() => removePhoto(img)} style={s.remove}><X size={14} color={colors.paper} /></Pressable>
              </View>
            ))}
            {uploading ? <View style={[s.photo, s.add]}><ActivityIndicator color={colors.ink} /><T v="small" color={colors.muted}>Uploading…</T></View> : null}
            {images.length < MAX_PHOTOS ? (
              <>
                <Pressable accessibilityRole="button" onPress={() => pick('library')} style={[s.photo, s.add]}><ImagePlus size={24} color={colors.ink} /><T v="small">Gallery</T></Pressable>
                {Platform.OS !== 'web' ? <Pressable accessibilityRole="button" onPress={() => pick('camera')} style={[s.photo, s.add]}><Camera size={24} color={colors.ink} /><T v="small">Camera</T></Pressable> : null}
              </>
            ) : null}
          </ScrollView>
          {errors.imageIds ? <T v="small" color={colors.danger}>{errors.imageIds}</T> : <T v="small" color={colors.muted}>Tap a photo to make it the cover. Honest photos get more offers.</T>}
        </View>

        <Field label="Title" value={f.title} onChangeText={set('title')} maxLength={80} placeholder="e.g. Retro running sneakers, UK 9" error={errors.title} />
        <Field label="Description" value={f.description} onChangeText={set('description')} multiline maxLength={2000} placeholder="Condition, size, story, any flaws…" error={errors.description} />

        <View style={{ gap: 10 }}>
          <T v="heading">Category</T>
          <View style={s.wrap}>{CATEGORIES.map((c) => { const I = CATEGORY_ICON[c]; const on = category === c; return <Chip key={c} label={CATEGORY_LABELS[c]} active={on} onPress={() => setCategory(c)} icon={<I size={15} color={on ? colors.paper : colors.ink} />} />; })}</View>
          {errors.category ? <T v="small" color={colors.danger}>{errors.category}</T> : null}
        </View>
        <View style={{ gap: 10 }}>
          <T v="heading">Condition</T>
          <View style={s.wrap}>{CONDITIONS.map((c) => <Chip key={c} label={CONDITION_LABELS[c]} active={condition === c} onPress={() => setCondition(c)} />)}</View>
          {errors.condition ? <T v="small" color={colors.danger}>{errors.condition}</T> : null}
        </View>

        <Field label="Estimated value (₹, optional)" value={f.value} onChangeText={(v) => set('value')(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="e.g. 2500" hint="Your own estimate — not an appraisal." />
        <Field label="What would you swap it for?" value={f.wantedText} onChangeText={set('wantedText')} maxLength={300} placeholder="e.g. Headphones, a film camera, or open to offers" />

        <View style={{ gap: 10 }}>
          <T v="heading">Cash difference</T>
          <View style={s.wrap}>{CASH.map((c) => <Chip key={c.v} label={c.label} active={cash === c.v} onPress={() => setCash(c.v)} />)}</View>
        </View>
        <View style={{ gap: 10 }}>
          <T v="heading">How to exchange</T>
          <View style={s.wrap}>{(['LOCAL_HANDOVER', 'SHIPPING'] as const).map((m) => <Chip key={m} label={m === 'SHIPPING' ? 'Shipping' : 'Local meet-up'} active={methods.includes(m)} onPress={() => setMethods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))} />)}</View>
          {errors.exchangeMethods ? <T v="small" color={colors.danger}>{errors.exchangeMethods}</T> : null}
        </View>
      </ScrollView>
      <View style={[s.bar, { paddingBottom: insets.bottom + 12 }]}>
        <Button title="Publish listing" size="lg" loading={busy} disabled={uploading > 0} onPress={submit} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  photo: { width: 96, height: 120, borderRadius: 16, overflow: 'hidden', backgroundColor: '#EFEBE4' },
  add: { alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: colors.surface },
  cover: { position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.coral, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  remove: { position: 'absolute', right: 6, top: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(23,21,30,0.7)', alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(250,248,245,0.97)', borderTopWidth: 1, borderTopColor: colors.line },
});
