import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeftRight, RotateCcw, Send } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, BackHeader, Badge, ErrorState, Loading, T } from '@/components/ui';
import { absUrl, api, newIdempotencyKey } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { clockTime, formatINR } from '@/lib/format';
import { OFFER_STATUS } from '@/lib/offers';
import type { ConversationSummary, Message } from '@/lib/types';
import { colors, fonts, radius } from '@/theme/tokens';

type Local = Message & { pending?: boolean; failed?: boolean };

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>(); const insets = useSafeAreaInsets(); const { user } = useAuth(); const qc = useQueryClient();
  const convs = useQuery({ queryKey: ['conversations'], queryFn: () => api<ConversationSummary[]>('/conversations') });
  const conv = convs.data?.find((c) => c.id === id); const other = conv?.participants[0];

  const [msgs, setMsgs] = useState<Local[]>([]); const [loaded, setLoaded] = useState(false); const [error, setError] = useState(false);
  const [text, setText] = useState(''); const list = useRef<FlatList<Local>>(null);
  const lastId = useRef<string | null>(null);

  const markRead = useCallback(() => { api(`/conversations/${id}/read`, { method: 'POST' }).then(() => { qc.invalidateQueries({ queryKey: ['pulse'] }); qc.invalidateQueries({ queryKey: ['conversations'] }); }).catch(() => undefined); }, [id, qc]);

  // Initial page, then poll for anything newer (incremental ?after=, like the web app).
  useEffect(() => {
    let alive = true; let timer: ReturnType<typeof setTimeout>;
    const merge = (incoming: Message[]) => setMsgs((cur) => {
      const byClient = new Map(cur.filter((m) => m.clientId).map((m) => [m.clientId, m]));
      const known = new Set(cur.map((m) => m.id)); const next = [...cur];
      for (const m of incoming) {
        if (m.clientId && byClient.has(m.clientId)) { const i = next.indexOf(byClient.get(m.clientId)!); next[i] = m; continue; } // our optimistic copy → server copy
        if (!known.has(m.id)) next.push(m);
      }
      return next;
    });
    const tick = async () => {
      try {
        const r = await api<{ items: Message[] }>(`/conversations/${id}/messages${lastId.current ? `?after=${lastId.current}` : '?limit=50'}`);
        if (!alive) return;
        if (r.items.length) { lastId.current = r.items[r.items.length - 1].id; merge(r.items); if (r.items.some((m) => m.sender?.id !== user?.id)) markRead(); }
        setLoaded(true); setError(false);
      } catch { if (alive && !lastId.current) setError(true); }
      if (alive && AppState.currentState === 'active') timer = setTimeout(tick, 4000);
    };
    tick(); markRead();
    const sub = AppState.addEventListener('change', (s) => { clearTimeout(timer); if (s === 'active') tick(); });
    return () => { alive = false; clearTimeout(timer); sub.remove(); };
  }, [id, user?.id, markRead]);

  async function send(content: string, clientId = newIdempotencyKey()) {
    const optimistic: Local = { id: `local-${clientId}`, clientId, conversationId: id, type: 'TEXT', content, createdAt: new Date().toISOString(), sender: user ? { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl } : null, attachments: [], offerRevision: null, pending: true };
    setMsgs((cur) => [...cur.filter((m) => m.clientId !== clientId), optimistic]);
    try {
      const m = await api<Message>(`/conversations/${id}/messages`, { method: 'POST', body: { content, clientId } });
      setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur.filter((x) => x.clientId !== clientId || x.id === m.id) : cur.map((x) => (x.clientId === clientId ? m : x))));
    } catch { setMsgs((cur) => cur.map((x) => (x.clientId === clientId ? { ...x, pending: false, failed: true } : x))); }
  }
  const submit = () => { const t = text.trim(); if (!t) return; setText(''); send(t); };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.paper }}>
        <BackHeader label="Messages" fallback="/messages" right={other ? (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/user/${other.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 6, flexShrink: 1 }}>
            <View style={{ alignItems: 'flex-end', flexShrink: 1 }}><T v="strong" numberOfLines={1}>{other.displayName}</T>{conv?.listing ? <T v="small" color={colors.muted} numberOfLines={1}>re: {conv.listing.title}</T> : null}</View>
            <Avatar name={other.displayName} url={other.avatarUrl} size={36} />
          </Pressable>
        ) : undefined} />
      </View>
      {error ? <ErrorState message="Couldn't load messages — retrying automatically." /> : !loaded ? <Loading /> : (
        <FlatList
          ref={list} data={msgs} keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<T color={colors.muted} style={{ textAlign: 'center', marginTop: 40 }}>Say hi 👋 — messages stay between you two.</T>}
          renderItem={({ item: m }) => <Bubble m={m} mine={m.sender?.id === user?.id} onRetry={() => send(m.content, m.clientId ?? undefined)} />}
        />
      )}
      <View style={[s.composer, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput value={text} onChangeText={setText} placeholder="Message…" placeholderTextColor={colors.muted} multiline maxLength={2000} style={s.input} accessibilityLabel="Message" />
        <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={!text.trim()} onPress={submit} style={[s.send, !text.trim() && { opacity: 0.4 }]}><Send size={18} color={colors.ink} /></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ m, mine, onRetry }: { m: Local; mine: boolean; onRetry: () => void }) {
  if (m.type === 'SYSTEM') return <T v="small" color={colors.muted} style={{ textAlign: 'center', paddingVertical: 6 }}>{m.content}</T>;
  if (m.type === 'OFFER_CARD' && m.offerRevision) {
    const r = m.offerRevision; const st = m.offerStatus ? OFFER_STATUS[m.offerStatus] : null;
    const thumbs = r.items.slice(0, 4);
    return (
      <Pressable accessibilityRole="link" onPress={() => router.push(`/offer/${r.offerId}`)} style={[s.offer, mine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <ArrowLeftRight size={14} color={colors.ink} /><T v="strong" style={{ fontSize: 14 }}>Offer · version {r.number}</T>
          {st ? <Badge label={m.isCurrentRevision === false ? 'Replaced' : st.label} tone={m.isCurrentRevision === false ? 'neutral' : st.tone} /> : null}
          {m.yourTurn && m.isCurrentRevision !== false ? <Badge label="Your turn" tone="cobalt" /> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>{thumbs.map((it) => <Image key={it.listing.id + it.role} source={absUrl(it.listing.thumbUrl)} style={s.offerThumb} contentFit="cover" />)}</View>
        {r.cashAmount > 0 ? <T v="small" color={colors.muted} style={{ marginTop: 8 }}>+ {formatINR(r.cashAmount)} cash</T> : null}
        <T v="small" style={{ marginTop: 8, fontFamily: fonts.semibold, textDecorationLine: 'underline' }}>{m.yourTurn && m.isCurrentRevision !== false ? 'Review & respond' : 'View offer'}</T>
      </Pressable>
    );
  }
  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
      <View style={[s.bubble, mine ? s.mine : s.theirs, m.failed && { backgroundColor: colors.dangerSoft }]}>
        <T style={{ color: mine && !m.failed ? colors.paper : colors.ink }}>{m.content}</T>
      </View>
      {m.failed ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}><RotateCcw size={12} color={colors.danger} /><T v="small" color={colors.danger}>Not sent — tap to retry</T></Pressable>
      ) : <T v="small" color={colors.muted} style={{ fontSize: 11, marginTop: 3 }}>{m.pending ? 'Sending…' : clockTime(m.createdAt)}</T>}
    </View>
  );
}

const s = StyleSheet.create({
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  mine: { backgroundColor: colors.ink, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
  offer: { width: '85%', backgroundColor: colors.lilac, borderRadius: 20, padding: 14 },
  offerThumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#EFEBE4' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper },
  input: { flex: 1, minHeight: 46, maxHeight: 130, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
});
