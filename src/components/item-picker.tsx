import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { T } from '@/components/ui';
import { absUrl } from '@/lib/api';
import { formatINR } from '@/lib/format';
import type { ListingBrief } from '@/lib/types';
import { colors, fonts } from '@/theme/tokens';

/** Grid of selectable items (max 5, matching the API's limit). */
export function ItemPicker({ title, hint, items, selected, onChange, empty, max = 5 }: { title: string; hint?: string; items: ListingBrief[]; selected: string[]; onChange: (ids: string[]) => void; empty?: React.ReactNode; max?: number }) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : selected.length >= max ? selected : [...selected, id]);
  return (
    <View style={{ gap: 10 }}>
      <View><T v="heading">{title}</T>{hint ? <T v="small" color={colors.muted}>{hint}</T> : null}</View>
      {items.length === 0 ? empty : (
        <View style={s.grid}>
          {items.map((i) => {
            const on = selected.includes(i.id);
            return (
              <Pressable key={i.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={i.title} onPress={() => toggle(i.id)} style={[s.tile, on && s.tileOn]}>
                <Image source={absUrl(i.thumbUrl)} style={s.img} contentFit="cover" />
                {on ? <View style={s.check}><Check size={14} color={colors.paper} strokeWidth={3} /></View> : null}
                <Text numberOfLines={1} style={s.title}>{i.title}</Text>
                <Text style={s.value}>{i.estimatedValue != null ? `~${formatINR(i.estimatedValue)}` : ' '}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '31%', borderRadius: 16, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface, padding: 4 },
  tileOn: { borderColor: colors.ink },
  img: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#EFEBE4' },
  check: { position: 'absolute', top: 9, right: 9, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink, marginTop: 5, paddingHorizontal: 2 },
  value: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, paddingHorizontal: 2, paddingBottom: 2 },
});
