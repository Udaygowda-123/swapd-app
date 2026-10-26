import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Eye } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORY_ICON } from '@/components/category-icons';
import { ListingCard } from '@/components/listing-card';
import { PhotoUploader } from '@/components/photo-uploader';
import { Sheet } from '@/components/sheet';
import { BackHeader, Button, Chip, Field, T } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatINR } from '@/lib/format';
import { CATEGORIES, CATEGORY_LABELS, CONDITION_LABELS, CONDITIONS, type CashFlexibility, type Category, type Condition, type ExchangeMethod } from '@/lib/shared';
import { useToast } from '@/lib/toast';
import type { ImageDto, Listing } from '@/lib/types';
import { colors } from '@/theme/tokens';

// Same wording as the web listing form.
const CASH: Record<CashFlexibility, string> = { NONE: 'Straight swap only', WILL_ADD: 'I can add cash', WILL_ACCEPT: "I'd accept cash on top", EITHER: 'Open to cash either way' };

interface Values { title: string; description: string; category: Category; condition: Condition; value: string; wantedText: string; wantedCategories: Category[]; cashFlexibility: CashFlexibility; exchangeMethods: ExchangeMethod[] }

/** Create or edit a listing (web ListingForm): photos → details → what you'd swap for → preview → publish. */
export function ListingForm({ listing }: { listing?: Listing }) {
  const insets = useSafeAreaInsets(); const qc = useQueryClient(); const toast = useToast(); const { user } = useAuth();
  const [images, setImages] = useState<ImageDto[]>(listing?.images ?? []);
  const [coverId, setCoverId] = useState<string | null>(listing?.images.find((i) => i.isCover)?.id ?? listing?.images[0]?.id ?? null);
  const [v, setV] = useState<Values>(listing ? {
    title: listing.title, description: listing.description, category: listing.category, condition: listing.condition, value: listing.estimatedValue != null ? String(listing.estimatedValue) : '',
    wantedText: listing.wantedText ?? '', wantedCategories: listing.wantedCategories, cashFlexibility: listing.cashFlexibility, exchangeMethods: listing.exchangeMethods,
  } : { title: '', description: '', category: 'OTHER', condition: 'GOOD', value: '', wantedText: '', wantedCategories: [], cashFlexibility: 'NONE', exchangeMethods: ['LOCAL_HANDOVER'] });
  const [errors, setErrors] = useState<Record<string, string>>({}); const [preview, setPreview] = useState(false); const [busy, setBusy] = useState(false);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => { setV((x) => ({ ...x, [k]: val })); setErrors((e) => ({ ...e, [k]: '' })); };
  const onImages = useCallback((i: ImageDto[], c: string | null) => { setImages(i); setCoverId(c); setErrors((e) => ({ ...e, imageIds: '' })); }, []);

  function review() {
    const e: Record<string, string> = {};
    if (!images.length) e.imageIds = 'Add at least one photo';
    if (v.title.trim().length < 3) e.title = 'Use at least 3 characters';
    if (v.description.trim().length < 10) e.description = 'Tell people a bit more (10+ characters)';
    if (!v.exchangeMethods.length) e.exchangeMethods = 'Pick at least one exchange method';
    setErrors(e);
    if (Object.values(e).some(Boolean)) return toast.error(Object.values(e).find(Boolean)!);
    setPreview(true);
  }

  async function publish() {
    setBusy(true);
    const value = parseInt(v.value, 10);
    const body = {
      title: v.title.trim(), description: v.description.trim(), category: v.category, condition: v.condition, estimatedValue: Number.isFinite(value) ? value : null,
      wantedText: v.wantedText.trim() || null, wantedCategories: v.wantedCategories, cashFlexibility: v.cashFlexibility, exchangeMethods: v.exchangeMethods,
      imageIds: images.map((i) => i.id), coverImageId: coverId ?? undefined,
    };
    try {
      const saved = await api<Listing>(listing ? `/listings/${listing.id}` : '/listings', { method: listing ? 'PATCH' : 'POST', body });
      toast.success(listing ? 'Listing updated' : 'Your item is live 🎉'); qc.invalidateQueries(); setPreview(false);
      router.replace(`/listing/${saved.id}`);
    } catch (e) {
      setPreview(false);
      if (e instanceof ApiError && e.code === 'VALIDATION_FAILED') { const fe = e.fieldErrors(); setErrors(fe); toast.error(Object.values(fe)[0] ?? e.message); }
      else toast.error(e instanceof ApiError ? e.message : 'Could not save your listing. Try again.');
    } finally { setBusy(false); }
  }

  const value = parseInt(v.value, 10);
  const previewListing: Listing = {
    id: 'preview', ownerId: user?.id ?? '', title: v.title.trim() || 'Your item', description: v.description, category: v.category, condition: v.condition, estimatedValue: Number.isFinite(value) ? value : null, currency: 'INR',
    wantedText: v.wantedText.trim() || null, wantedCategories: v.wantedCategories, cashFlexibility: v.cashFlexibility, exchangeMethods: v.exchangeMethods, locationCity: user?.locationCity ?? null, locationRegion: null,
    status: 'ACTIVE', isSeedData: false, createdAt: new Date().toISOString(), images: images.map((i, n) => ({ ...i, isCover: i.id === coverId, position: n })), isOwner: true,
    owner: { id: user?.id ?? '', displayName: 'You', avatarUrl: null, locationCity: null, locationRegion: null, verified: false },
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: Platform.OS === 'ios' ? 8 : insets.top }}><BackHeader label="Cancel" /></View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 24, paddingBottom: 120 + insets.bottom }} keyboardShouldPersistTaps="handled">
        <View>
          <T v="display">{listing ? 'Edit' : 'List an'} <T v="accent" color={colors.cobaltInk}>{listing ? 'listing' : 'item'}</T></T>
          <T color={colors.muted}>{listing ? 'Changes show to everyone once you save.' : "Add photos, tell people what it is, and what you'd swap it for."}</T>
        </View>

        <View style={{ gap: 8 }}>
          <T v="heading">Photos <T color={colors.muted}>({images.length}/8)</T></T>
          <T v="small" color={colors.muted}>Natural light and a clean background work best. The cover photo is shown in the feed.</T>
          <PhotoUploader images={images} coverId={coverId} onChange={onImages} />
          {errors.imageIds ? <T v="small" color={colors.danger}>{errors.imageIds}</T> : null}
        </View>

        <View style={{ gap: 16 }}>
          <T v="heading">Details</T>
          <Field label="Title" value={v.title} onChangeText={(t) => set('title', t)} maxLength={80} placeholder="e.g. Retro running sneakers, UK 9" error={errors.title} />
          <Field label="Description" value={v.description} onChangeText={(t) => set('description', t)} multiline maxLength={2000} placeholder="Condition, size, story…" hint="Be honest about flaws — it builds trust and avoids disputes." error={errors.description} />
          <T v="strong">Category</T>
          <View style={s.wrap}>{CATEGORIES.map((c) => { const I = CATEGORY_ICON[c]; const on = v.category === c; return <Chip key={c} label={CATEGORY_LABELS[c]} active={on} onPress={() => set('category', c)} icon={<I size={15} color={on ? colors.paper : colors.ink} />} />; })}</View>
          <T v="strong">Condition</T>
          <View style={s.wrap}>{CONDITIONS.map((c) => <Chip key={c} label={CONDITION_LABELS[c]} active={v.condition === c} onPress={() => set('condition', c)} />)}</View>
          <Field label="Estimated value (₹, optional)" value={v.value} onChangeText={(t) => set('value', t.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" placeholder="e.g. 2500" hint="Your own estimate to help others judge a fair swap — it isn't an appraisal." error={errors.estimatedValue} />
        </View>

        <View style={{ gap: 16 }}>
          <T v="heading">What would you swap for?</T>
          <Field label="Looking for" value={v.wantedText} onChangeText={(t) => set('wantedText', t)} maxLength={300} placeholder="e.g. wireless headphones, or a handheld console" error={errors.wantedText} />
          <T v="strong">Categories you&apos;d be happy to receive</T>
          <View style={s.wrap}>{CATEGORIES.map((c) => { const on = v.wantedCategories.includes(c); return <Chip key={c} label={CATEGORY_LABELS[c]} active={on} onPress={() => set('wantedCategories', on ? v.wantedCategories.filter((x) => x !== c) : [...v.wantedCategories, c])} />; })}</View>
          <T v="strong">Cash difference</T>
          <View style={s.wrap}>{(Object.keys(CASH) as CashFlexibility[]).map((k) => <Chip key={k} label={CASH[k]} active={v.cashFlexibility === k} onPress={() => set('cashFlexibility', k)} />)}</View>
          <T v="strong">Exchange methods</T>
          <View style={s.wrap}>{(['LOCAL_HANDOVER', 'SHIPPING'] as const).map((m) => { const on = v.exchangeMethods.includes(m); return <Chip key={m} label={m === 'SHIPPING' ? 'Shipping' : 'Local meet-up'} active={on} onPress={() => set('exchangeMethods', on ? v.exchangeMethods.filter((x) => x !== m) : [...v.exchangeMethods, m])} />; })}</View>
          {errors.exchangeMethods ? <T v="small" color={colors.danger}>{errors.exchangeMethods}</T> : null}
        </View>
      </ScrollView>

      <View style={[s.bar, { paddingBottom: insets.bottom + 12 }]}>
        <Button title={`Preview & ${listing ? 'save' : 'publish'}`} size="lg" icon={<Eye size={18} color={colors.ink} />} onPress={review} />
      </View>

      <Sheet open={preview} onClose={() => setPreview(false)} title="Preview" description="This is how your listing will look in the feed."
        footer={<><Button title="Keep editing" variant="ghost" style={{ flex: 1 }} onPress={() => setPreview(false)} /><Button title={listing ? 'Save changes' : 'Publish listing'} style={{ flex: 1.3 }} loading={busy} onPress={publish} /></>}>
        <View pointerEvents="none" style={{ width: 220, alignSelf: 'center' }}><ListingCard listing={previewListing} /></View>
        <View style={s.dl}><T color={colors.muted}>Estimated value</T><T v="strong">{formatINR(previewListing.estimatedValue)}</T></View>
        <View style={s.dl}><T color={colors.muted}>Photos</T><T v="strong">{images.length}{images.some((i) => i.aiEdited) ? ' (some AI-enhanced)' : ''}</T></View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dl: { flexDirection: 'row', justifyContent: 'space-between' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(250,248,245,0.97)', borderTopWidth: 1, borderTopColor: colors.line },
});
