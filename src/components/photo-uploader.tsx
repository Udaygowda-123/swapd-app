import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, ArrowRight, Camera, ImagePlus, Sparkles, Star, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { T } from '@/components/ui';
import { absUrl, api, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast';
import type { ImageDto } from '@/lib/types';
import { uploadPhoto } from '@/lib/upload';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * Same flow as the web uploader: upload → server re-encodes & strips metadata → an enhanced version may arrive
 * asynchronously (polled here) → the owner picks Original or Enhanced per photo, sets the cover and the order.
 */
export function PhotoUploader({ images, coverId, onChange, max = 8 }: { images: ImageDto[]; coverId: string | null; onChange: (images: ImageDto[], cover: string | null) => void; max?: number }) {
  const toast = useToast(); const [uploading, setUploading] = useState(0);
  const state = useRef({ images, coverId });
  useEffect(() => { state.current = { images, coverId }; }, [images, coverId]); // latest values for async upload/poll callbacks

  // Poll photos that are still being processed (1s, like the web).
  useEffect(() => {
    const pending = images.filter((i) => i.status === 'PROCESSING' || i.status === 'PENDING'); if (!pending.length) return;
    const t = setInterval(async () => {
      const fresh = await Promise.all(pending.map((p) => api<ImageDto>(`/media/images/${p.id}`).catch(() => p)));
      const map = new Map(fresh.map((f) => [f.id, f]));
      onChange(state.current.images.map((i) => map.get(i.id) ?? i), state.current.coverId);
    }, 1000);
    return () => clearInterval(t);
  }, [images, onChange]);

  async function pick(source: 'library' | 'camera') {
    const room = max - state.current.images.length; if (room <= 0) return toast.error(`You can add up to ${max} photos`);
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast.error(source === 'camera' ? 'Allow camera access in Settings to take photos.' : 'Allow photo access in Settings to add pictures.');
    const res = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 1, orderedSelection: true });
    if (res.canceled) return;
    for (const a of res.assets.slice(0, room)) {
      setUploading((n) => n + 1);
      try {
        const img = await uploadPhoto(a.uri, a.width);
        const list = [...state.current.images, img]; onChange(list, state.current.coverId ?? img.id);
      } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not upload a photo. Check your connection.'); }
      finally { setUploading((n) => n - 1); }
    }
  }
  async function choose(img: ImageDto, useEnhanced: boolean) {
    try { const updated = await api<ImageDto>(`/media/images/${img.id}`, { method: 'PATCH', body: { useEnhanced } }); onChange(state.current.images.map((i) => (i.id === img.id ? updated : i)), state.current.coverId); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not switch version'); }
  }
  function remove(img: ImageDto) {
    const rest = images.filter((i) => i.id !== img.id);
    onChange(rest, coverId === img.id ? (rest[0]?.id ?? null) : coverId);
    api(`/media/images/${img.id}`, { method: 'DELETE' }).catch(() => undefined); // same as web: photos already attached to a listing are dropped on save instead
  }
  const move = (i: number, d: -1 | 1) => { const a = [...images]; [a[i], a[i + d]] = [a[i + d], a[i]]; onChange(a, coverId); };

  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 2 }}>
        {images.map((img, i) => {
          const processing = img.status === 'PROCESSING' || img.status === 'PENDING';
          return (
            <View key={img.id} style={[s.tile, coverId === img.id && { borderColor: colors.ink }]}>
              <View style={s.photo}>
                <Image source={absUrl(img.thumbUrl ?? img.url)} style={StyleSheet.absoluteFill} contentFit="cover" />
                {coverId === img.id ? <View style={s.cover}><Star size={10} color={colors.paper} fill={colors.paper} /><T v="small" style={{ fontSize: 10, fontFamily: fonts.bold, color: colors.paper }}>Cover</T></View> : null}
                {processing ? <View style={s.processing}><ActivityIndicator size="small" color={colors.ink} /><T v="small" style={{ fontSize: 11, fontFamily: fonts.semibold }}>Enhancing…</T></View> : null}
              </View>
              {img.enhancedUrl ? (
                <View style={s.versions} accessibilityRole="radiogroup" accessibilityLabel={`Version of photo ${i + 1}`}>
                  <Pressable accessibilityRole="radio" accessibilityState={{ checked: !img.useEnhanced }} onPress={() => choose(img, false)} style={[s.ver, !img.useEnhanced && s.verOn]}><T v="small" style={{ fontSize: 11, fontFamily: fonts.semibold }}>Original</T></Pressable>
                  <Pressable accessibilityRole="radio" accessibilityState={{ checked: img.useEnhanced }} onPress={() => choose(img, true)} style={[s.ver, img.useEnhanced && [s.verOn, { backgroundColor: colors.lilac }]]}><Sparkles size={10} color={colors.lavenderInk} /><T v="small" style={{ fontSize: 11, fontFamily: fonts.semibold }} color={colors.lavenderInk}>Enhanced</T></Pressable>
                </View>
              ) : img.status === 'FAILED' ? <T v="small" color={colors.muted} style={{ fontSize: 11, paddingHorizontal: 4 }} numberOfLines={2}>{img.error ?? 'Enhancement unavailable'}</T> : null}
              <View style={s.tools}>
                <Pressable accessibilityRole="button" accessibilityLabel="Make cover" disabled={coverId === img.id} onPress={() => onChange(images, img.id)} style={s.tool}><Star size={15} color={coverId === img.id ? colors.line : colors.ink} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Move photo ${i + 1} earlier`} disabled={i === 0} onPress={() => move(i, -1)} style={s.tool}><ArrowLeft size={15} color={i === 0 ? colors.line : colors.ink} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Move photo ${i + 1} later`} disabled={i === images.length - 1} onPress={() => move(i, 1)} style={s.tool}><ArrowRight size={15} color={i === images.length - 1 ? colors.line : colors.ink} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} onPress={() => remove(img)} style={s.tool}><Trash2 size={15} color={colors.danger} /></Pressable>
              </View>
            </View>
          );
        })}
        {uploading ? <View style={[s.add]}><ActivityIndicator color={colors.ink} /><T v="small" color={colors.muted}>Uploading…</T></View> : null}
        {images.length < max ? (
          <>
            <Pressable accessibilityRole="button" onPress={() => pick('library')} style={s.add}><ImagePlus size={26} color={colors.ink} /><T v="strong" style={{ fontSize: 13 }}>Add photos</T><T v="small" color={colors.muted} style={{ fontSize: 11 }}>From gallery</T></Pressable>
            {Platform.OS !== 'web' ? <Pressable accessibilityRole="button" onPress={() => pick('camera')} style={s.add}><Camera size={26} color={colors.ink} /><T v="strong" style={{ fontSize: 13 }}>Camera</T><T v="small" color={colors.muted} style={{ fontSize: 11 }}>Take a photo</T></Pressable> : null}
          </>
        ) : null}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Sparkles size={13} color={colors.muted} style={{ marginTop: 2 }} />
        <T v="small" color={colors.muted} style={{ flex: 1, fontSize: 12 }}>Enhancement balances light and framing — it never hides scratches, damage or serial numbers. Originals are kept, and enhanced photos are labelled “AI-enhanced”.</T>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  tile: { width: 132, borderRadius: 18, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface, padding: 4, gap: 6 },
  photo: { width: '100%', aspectRatio: 0.8, borderRadius: 14, overflow: 'hidden', backgroundColor: '#EFEBE4' },
  cover: { position: 'absolute', left: 6, top: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  processing: { position: 'absolute', left: 6, right: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: 'rgba(250,248,245,0.95)', borderRadius: radius.pill, paddingVertical: 4 },
  versions: { flexDirection: 'row', gap: 2, padding: 2, borderRadius: radius.pill, backgroundColor: colors.overlay },
  ver: { flex: 1, height: 28, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  verOn: { backgroundColor: colors.surface },
  tools: { flexDirection: 'row', justifyContent: 'space-between' },
  tool: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  add: { width: 120, minHeight: 170, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8 },
});
