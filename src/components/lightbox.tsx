import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { absUrl } from '@/lib/api';
import type { ImageDto } from '@/lib/types';
import { colors, fonts } from '@/theme/tokens';

/** Full-screen photo viewer (web Lightbox): swipe between photos, thumbnails to jump, counter, close. */
export function Lightbox({ images, title, start, open, onClose }: { images: ImageDto[]; title: string; start: number; open: boolean; onClose: () => void }) {
  const { width, height } = useWindowDimensions(); const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(start); const list = useRef<FlatList<ImageDto>>(null);
  useEffect(() => { if (open) setIndex(start); }, [open, start]); // eslint-disable-line react-hooks/set-state-in-effect -- sync to the tapped photo when reopened
  const go = (i: number) => { setIndex(i); list.current?.scrollToIndex({ index: i, animated: true }); };

  return (
    <Modal visible={open} animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={['portrait', 'landscape']}>
      <View style={s.root}>
        <View style={[s.top, { paddingTop: insets.top + 8 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close photos" onPress={onClose} style={s.close}><X size={22} color={colors.paper} /></Pressable>
          <Text style={s.counter} accessibilityLiveRegion="polite">{index + 1} / {images.length}</Text>
          <View style={{ width: 44 }} />
        </View>
        <FlatList
          ref={list} data={images} keyExtractor={(i) => i.id} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          initialScrollIndex={start} getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            <View style={{ width, height: height * 0.72, justifyContent: 'center' }}>
              <Image source={absUrl(item.url)} style={{ width, height: '100%' }} contentFit="contain" cachePolicy="memory-disk" accessibilityLabel={item.altText ?? `${title} photo ${i + 1}`} />
            </View>
          )}
        />
        {images.length > 1 ? (
          <View style={[s.thumbs, { paddingBottom: insets.bottom + 16 }]}>
            {images.map((img, i) => (
              <Pressable key={img.id} accessibilityRole="button" accessibilityLabel={`Show photo ${i + 1}`} accessibilityState={{ selected: i === index }} onPress={() => go(i)} style={[s.thumb, i === index && s.thumbOn]}>
                <Image source={absUrl(img.thumbUrl ?? img.url)} style={StyleSheet.absoluteFill} contentFit="cover" />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  counter: { fontFamily: fonts.semibold, fontSize: 14, color: colors.paper, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, overflow: 'hidden' },
  thumbs: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 12, flexWrap: 'wrap', paddingHorizontal: 16 },
  thumb: { width: 54, height: 54, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', opacity: 0.5 },
  thumbOn: { borderColor: colors.paper, opacity: 1 },
});
