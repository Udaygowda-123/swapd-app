import { Image } from 'expo-image';
import { ArrowLeftRight } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { absUrl } from '@/lib/api';
import { formatINR } from '@/lib/format';
import type { ListingBrief } from '@/lib/types';
import { colors, fonts } from '@/theme/tokens';

/** Dark "you give ⇄ you get" summary used by the composer, offer cards and offer detail. */
export function ProposalStrip({ give, get, cash, cashFromYou, otherName, light }: { give: ListingBrief[]; get: ListingBrief[]; cash: number; cashFromYou: boolean; otherName: string; light?: boolean }) {
  const sub = light ? colors.muted : 'rgba(250,248,245,0.6)';
  const cashText = cash > 0 ? `+ ${formatINR(cash)} cash` : null;
  const side = (label: string, items: ListingBrief[], extra: string | null, right?: boolean) => (
    <View style={{ flex: 1, alignItems: right ? 'flex-end' : 'flex-start' }}>
      <Text numberOfLines={1} style={[s.label, { color: sub }]}>{label}</Text>
      <View style={s.thumbs}>
        {items.length ? items.slice(0, 3).map((i) => <Image key={i.id} source={absUrl(i.thumbUrl)} style={[s.thumb, light && s.thumbSm]} contentFit="cover" accessibilityLabel={i.title} />)
          : <View style={[s.empty, light && { borderColor: colors.line, height: 40 }]}><Text style={[s.emptyText, { color: sub }]}>{extra ? 'Cash only' : 'Nothing yet'}</Text></View>}
        {items.length > 3 ? <View style={[s.thumb, s.more]}><Text style={s.moreText}>+{items.length - 3}</Text></View> : null}
      </View>
      {extra ? <Text style={[s.cash, { color: light ? colors.mintInk : colors.violet }]}>{extra}</Text> : null}
    </View>
  );
  return (
    <View style={[s.wrap, light ? [s.light, s.compact] : s.dark]}>
      {side('You give', give, cashFromYou ? cashText : null)}
      <View style={s.swap}><ArrowLeftRight size={18} color={colors.ink} /></View>
      {side(`From ${otherName}`, get, !cashFromYou ? cashText : null, true)}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 24, padding: 16 },
  compact: { padding: 12, borderRadius: 18 },
  dark: { backgroundColor: colors.ink },
  light: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  label: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  thumbs: { flexDirection: 'row', gap: 5, marginTop: 8 },
  thumb: { width: 46, height: 46, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0 },
  thumbSm: { width: 40, height: 40, borderRadius: 10 },
  more: { alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: fonts.bold, fontSize: 12, color: colors.paper },
  empty: { height: 46, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.3)', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.medium, fontSize: 12 },
  cash: { fontFamily: fonts.semibold, fontSize: 12, marginTop: 6 },
  swap: { alignSelf: 'center', width: 36, height: 36, borderRadius: 18, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
});
