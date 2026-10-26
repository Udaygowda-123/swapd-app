import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeftRight, Ban, Flag, ImagePlus, MoreVertical, Send, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReportSheet } from '@/components/report-sheet';
import { Sheet } from '@/components/sheet';
import { Avatar, BackHeader, Badge, Button, ErrorState, Skeleton, T } from '@/components/ui';
import { absUrl, api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { clockTime, formatINR } from '@/lib/format';
import { OFFER_STATUS } from '@/lib/offers';
import { useToast } from '@/lib/toast';
import type { ConversationSummary, ImageDto, Message } from '@/lib/types';
import { uploadPhoto } from '@/lib/upload';
import { colors, fonts, radius } from '@/theme/tokens';

type Thread = { items: Message[]; hasMore: boolean };
interface Pending { cid: string; content: string; attach: ImageDto[]; status: 'sending' | 'failed' }

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>(); const insets = useSafeAreaInsets(); const { user } = useAuth(); const qc = useQueryClient(); const toast = useToast();
  /** First load fetches the thread; every poll after that asks only for messages newer than the last one we have (same as web). */
  const msgs = useQuery({
    queryKey: ['messages', id], retry: false, refetchInterval: 4000, staleTime: 0,
    queryFn: async (): Promise<Thread> => {
      const prev = qc.getQueryData<Thread>(['messages', id]); const last = prev?.items.at(-1);
      if (!prev || !last) return api<Thread>(`/conversations/${id}/messages?limit=100`);
      const r = await api<Thread>(`/conversations/${id}/messages?after=${last.id}`);
      if (!r.items.length) return prev;
      const seen = new Set(prev.items.map((m) => m.id));
      return { items: [...prev.items, ...r.items.filter((m) => !seen.has(m.id))].slice(-300), hasMore: prev.hasMore };
    },
  });
  const convs = useQuery({ queryKey: ['conversations'], queryFn: () => api<ConversationSummary[]>('/conversations'), staleTime: 15_000 });
  const conv = convs.data?.find((c) => c.id === id); const other = conv?.participants[0];

  const [text, setText] = useState(''); const [pending, setPending] = useState<Pending[]>([]); const [attach, setAttach] = useState<ImageDto[]>([]); const [attaching, setAttaching] = useState(false);
  const [menu, setMenu] = useState(false); const [report, setReport] = useState(false);
  const list = useRef<FlatList<Message | Pending>>(null); const lastId = msgs.data?.items.at(-1)?.id;

  useEffect(() => { // mark read whenever the newest message changes while the thread is open
    if (!lastId) return;
    api(`/conversations/${id}/read`, { method: 'POST' }).then(() => { qc.invalidateQueries({ queryKey: ['conversations'] }); qc.invalidateQueries({ queryKey: ['pulse'] }); }).catch(() => undefined);
  }, [id, lastId, qc]);

  /** Optimistic send: the bubble appears instantly; on failure it stays with Retry (same clientId, so the server never duplicates). */
  async function deliver(p: Pending) {
    setPending((l) => l.map((x) => (x.cid === p.cid ? { ...x, status: 'sending' } : x)));
    try {
      await api(`/conversations/${id}/messages`, { method: 'POST', body: { content: p.content, clientId: p.cid, attachmentKeys: p.attach.map((a) => a.id) } });
      await qc.invalidateQueries({ queryKey: ['messages', id] }); setPending((l) => l.filter((x) => x.cid !== p.cid)); qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch (e) {
      setPending((l) => l.map((x) => (x.cid === p.cid ? { ...x, status: 'failed' } : x)));
      toast.error(e instanceof ApiError && e.status < 500 && e.status > 0 ? e.message : 'Message not sent — tap Retry.');
    }
  }
  function send() {
    const content = text.trim(); if (!content) return;
    const p: Pending = { cid: newIdempotencyKey(), content, attach, status: 'sending' };
    setPending((l) => [...l, p]); setText(''); setAttach([]); void deliver(p);
  }
  async function pickImage() {
    if (attach.length >= 4) return toast.error('Up to 4 photos per message');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast.error('Allow photo access in Settings to attach pictures.');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled) return;
    setAttaching(true);
    try { const img = await uploadPhoto(res.assets[0].uri); setAttach((a) => [...a, img].slice(-4)); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not attach image'); } finally { setAttaching(false); }
  }
  async function block() {
    setMenu(false);
    if (!other || !(await confirm(`Block ${other.displayName}?`, "You won't see each other's listings, and neither of you can message or make offers to the other.", 'Block', { destructive: true }))) return;
    try { await api(`/users/${other.id}/block`, { method: 'POST' }); toast.success(`${other.displayName} is blocked`); qc.invalidateQueries({ queryKey: ['conversations'] }); router.replace('/messages'); }
    catch { toast.error('Could not block this user'); }
  }

  const shownPending = pending.filter((p) => !msgs.data?.items.some((m) => m.clientId === p.cid));
  // Newest first + an inverted list: the latest message stays pinned to the bottom however tall photos/bubbles are.
  const data: (Message | Pending)[] = [...(msgs.data?.items ?? []), ...shownPending].reverse();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.header, { paddingTop: insets.top }]}>
        <BackHeader label="" fallback="/messages" right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
            <Pressable accessibilityRole="link" disabled={!other} onPress={() => other && router.push(`/user/${other.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              {other ? <Avatar name={other.displayName} url={other.avatarUrl} size={38} /> : null}
              <View style={{ flex: 1 }}>
                <T v="strong" numberOfLines={1}>{other?.displayName ?? '…'}</T>
                {conv?.offer ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><T v="small" color={colors.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{conv.listing?.title}</T><Badge label={OFFER_STATUS[conv.offer.status].label} tone={OFFER_STATUS[conv.offer.status].tone} /></View> : null}
              </View>
            </Pressable>
            {conv?.offer ? <Pressable accessibilityRole="link" accessibilityLabel="Open offer" onPress={() => router.push(`/offer/${conv.offer!.id}`)} style={s.iconBtn}><ArrowLeftRight size={18} color={colors.ink} /></Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Conversation options" onPress={() => setMenu(true)} style={s.iconBtn}><MoreVertical size={20} color={colors.ink} /></Pressable>
          </View>
        } />
      </View>

      {msgs.isError ? <ErrorState message={msgs.error instanceof ApiError && msgs.error.status === 404 ? 'This conversation does not exist.' : 'We could not load this conversation.'} onRetry={() => msgs.refetch()} /> : msgs.isPending ? (
        <View style={{ padding: 16, gap: 10 }}>{[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 52, width: '65%', borderRadius: 22, alignSelf: i % 2 ? 'flex-end' : 'flex-start' }} />)}</View>
      ) : (
        <FlatList
          ref={list} data={data} inverted keyExtractor={(m) => ('cid' in m ? `p-${m.cid}` : m.id)}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          keyboardDismissMode="interactive"
          ListEmptyComponent={<T color={colors.muted} style={{ textAlign: 'center', marginTop: 40 }}>Say hi 👋 — messages stay between you two.</T>}
          renderItem={({ item }) => ('cid' in item
            ? <PendingBubble p={item} onRetry={() => deliver(item)} onDiscard={() => setPending((l) => l.filter((x) => x.cid !== item.cid))} />
            : <Bubble m={item} mine={item.sender?.id === user?.id} meId={user?.id} />)}
        />
      )}

      <View style={[s.composer, { paddingBottom: insets.bottom + 8 }]}>
        {attach.length || attaching ? (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            {attach.map((a) => (
              <View key={a.id}>
                <Image source={absUrl(a.thumbUrl ?? a.url)} style={s.attachThumb} contentFit="cover" />
                <Pressable accessibilityRole="button" accessibilityLabel="Remove attachment" onPress={() => setAttach(attach.filter((x) => x.id !== a.id))} style={s.attachX}><X size={11} color={colors.paper} /></Pressable>
              </View>
            ))}
            {attaching ? <View style={[s.attachThumb, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay }]}><ActivityIndicator color={colors.ink} /></View> : null}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Attach an image" onPress={pickImage} style={s.attachBtn}><ImagePlus size={22} color={colors.ink} /></Pressable>
          <TextInput value={text} onChangeText={setText} placeholder="Write a message…" placeholderTextColor={colors.muted} multiline maxLength={2000} style={s.input} accessibilityLabel="Message" />
          <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!text.trim()} onPress={send} style={[s.send, !text.trim() && { opacity: 0.4 }]}><Send size={18} color={colors.ink} /></Pressable>
        </View>
        <T v="small" color={colors.muted} style={{ fontSize: 11, marginTop: 6, paddingHorizontal: 6 }}>Chat doesn&apos;t change an offer or deal — use the offer screen to accept terms.</T>
      </View>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Conversation">
        <Button title="Report" variant="outline" icon={<Flag size={16} color={colors.ink} />} onPress={() => { setMenu(false); setReport(true); }} />
        <Button title={`Block ${other?.displayName ?? 'user'}`} variant="danger" icon={<Ban size={16} color={colors.danger} />} onPress={block} />
      </Sheet>
      {other ? <ReportSheet open={report} onClose={() => setReport(false)} targetType="USER" targetId={other.id} subject={other.displayName} /> : null}
    </KeyboardAvoidingView>
  );
}

function PendingBubble({ p, onRetry, onDiscard }: { p: Pending; onRetry: () => void; onDiscard: () => void }) {
  return (
    <View style={{ alignSelf: 'flex-end', maxWidth: '82%', alignItems: 'flex-end', gap: 3 }}>
      <View style={[s.bubble, s.mine, p.status === 'sending' && { opacity: 0.6 }, p.status === 'failed' && { borderWidth: 2, borderColor: colors.danger }]}>
        {p.attach.map((a) => <Image key={a.id} source={absUrl(a.url)} style={s.attachment} contentFit="cover" />)}
        <T>{p.content}</T>
      </View>
      {p.status === 'sending' ? <T v="small" color={colors.muted} style={{ fontSize: 11 }}>Sending…</T> : (
        <View style={{ flexDirection: 'row', gap: 12 }} accessibilityRole="alert">
          <T v="small" color={colors.danger} style={{ fontFamily: fonts.semibold }}>Not sent</T>
          <Pressable accessibilityRole="button" onPress={onRetry}><T v="small" color={colors.danger} style={{ fontFamily: fonts.bold, textDecorationLine: 'underline' }}>Retry</T></Pressable>
          <Pressable accessibilityRole="button" onPress={onDiscard}><T v="small" color={colors.muted} style={{ textDecorationLine: 'underline' }}>Discard</T></Pressable>
        </View>
      )}
    </View>
  );
}

function Bubble({ m, mine, meId }: { m: Message; mine: boolean; meId?: string }) {
  if (m.type === 'SYSTEM') return <T v="small" color={colors.muted} style={s.system}>{m.content} · {clockTime(m.createdAt)}</T>;
  if (m.type === 'OFFER_CARD' && m.offerRevision) {
    const r = m.offerRevision; const offered = r.items.filter((i) => i.role === 'OFFERED'); const requested = r.items.filter((i) => i.role === 'REQUESTED');
    const current = m.isCurrentRevision || m.offerStatus === 'ACCEPTED'; const st = m.offerStatus ? OFFER_STATUS[m.offerStatus] : null;
    const toDeal = m.offerStatus === 'ACCEPTED' && m.dealId;
    return (
      <Pressable accessibilityRole="link" onPress={() => router.push(toDeal ? `/deal/${m.dealId}` : `/offer/${r.offerId}`)} style={[s.offer, mine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <T v="label" color={colors.muted} style={{ marginRight: 'auto' }}>{r.number === 1 ? 'Offer' : `Counteroffer · v${r.number}`} {r.authorId === meId ? 'from you' : `from ${m.sender?.displayName ?? 'them'}`}</T>
          {st ? (current ? <Badge label={st.label} tone={st.tone} /> : <Badge label="Superseded" />) : null}
          {m.yourTurn && m.isCurrentRevision ? <Badge label="Your turn" tone="cobalt" /> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 4 }}>{offered.slice(0, 3).map((i) => <Image key={i.listing.id} source={absUrl(i.listing.thumbUrl)} style={s.offerThumb} contentFit="cover" />)}</View>
            <T v="small" style={{ fontFamily: fonts.semibold }} numberOfLines={2}>{offered.length ? offered.map((i) => i.listing.title).join(', ') : 'Cash only'}</T>
          </View>
          <ArrowLeftRight size={16} color={colors.ink} />
          <View style={{ flex: 1, gap: 6, alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', gap: 4 }}>{requested.slice(0, 3).map((i) => <Image key={i.listing.id} source={absUrl(i.listing.thumbUrl)} style={s.offerThumb} contentFit="cover" />)}</View>
            <T v="small" style={{ fontFamily: fonts.semibold, textAlign: 'right' }} numberOfLines={2}>{requested.map((i) => i.listing.title).join(', ')}</T>
          </View>
        </View>
        {r.cashAmount > 0 ? <T v="small" style={s.cash}>+ {formatINR(r.cashAmount)} proposed{r.cashPayerId ? (r.cashPayerId === meId ? ' from you' : ' from them') : ''}</T> : null}
        {r.message ? <T v="small" color={colors.muted} style={{ marginTop: 8, fontStyle: 'italic' }}>“{r.message}”</T> : null}
        <T v="small" style={{ marginTop: 10, fontFamily: fonts.bold, textDecorationLine: 'underline' }}>{toDeal ? 'View deal' : m.yourTurn && m.isCurrentRevision ? 'Review & respond' : 'View offer'}</T>
        <T v="small" color={colors.muted} style={{ fontSize: 11, marginTop: 4 }}>{clockTime(m.createdAt)}</T>
      </Pressable>
    );
  }
  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', alignItems: mine ? 'flex-end' : 'flex-start', gap: 3 }}>
      <View style={[s.bubble, mine ? s.mine : s.theirs]}>
        {m.attachments.map((a) => <Image key={a.id} source={absUrl(a.url)} style={s.attachment} contentFit="cover" accessibilityLabel="Attached photo" />)}
        <T>{m.content}</T>
      </View>
      <T v="small" color={colors.muted} style={{ fontSize: 11 }}>{clockTime(m.createdAt)}</T>
    </View>
  );
}

const s = StyleSheet.create({
  header: { borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.paper },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  system: { alignSelf: 'center', textAlign: 'center', maxWidth: '90%', backgroundColor: colors.overlay, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, overflow: 'hidden', fontFamily: fonts.medium, fontSize: 12 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, gap: 8 },
  mine: { backgroundColor: colors.coralSoft, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
  attachment: { width: 220, height: 220, borderRadius: 16 },
  offer: { width: '88%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 24, padding: 16 },
  offerThumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFEBE4' },
  cash: { marginTop: 10, backgroundColor: colors.mint, color: colors.mintInk, fontFamily: fonts.bold, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden' },
  composer: { paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  attachBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 46, maxHeight: 130, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
  attachThumb: { width: 56, height: 56, borderRadius: 14 },
  attachX: { position: 'absolute', top: -5, right: -5, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
