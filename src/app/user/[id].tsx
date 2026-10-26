import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Ban, Flag, Pencil, UserX } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileHeader, UserListings, UserReviews } from '@/components/profile';
import { ReportSheet } from '@/components/report-sheet';
import { BackHeader, Button, EmptyState, ErrorState, Loading, T } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { useToast } from '@/lib/toast';
import type { PublicProfile } from '@/lib/types';
import { colors } from '@/theme/tokens';

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const insets = useSafeAreaInsets(); const { user, status } = useAuth(); const toast = useToast(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['profile', id], queryFn: () => api<PublicProfile>(`/users/${id}`), retry: false });
  const [report, setReport] = useState(false);
  const me = user?.id === id; const authed = status === 'authed';

  async function block() {
    if (!q.data || !(await confirm(`Block ${q.data.displayName}?`, "You won't see each other's listings, and neither of you can message or make offers to the other.", 'Block', { destructive: true }))) return;
    try { await api(`/users/${id}/block`, { method: 'POST' }); toast.success(`${q.data.displayName} is blocked`); qc.invalidateQueries({ queryKey: ['discover'] }); qc.invalidateQueries({ queryKey: ['conversations'] }); router.back(); }
    catch { toast.error('Could not block this user'); }
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <BackHeader />
      {q.isPending ? <Loading /> : q.error instanceof ApiError && q.error.status === 404 ? <EmptyState icon={<UserX size={28} color={colors.coralInk} />} title="Profile not found" action={<Button title="Back to Discover" onPress={() => router.replace('/')} />} />
        : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 18, paddingBottom: 40 + insets.bottom }}>
            <ProfileHeader p={q.data}>
              {me ? <Button title="Edit profile" size="sm" variant="outline" icon={<Pencil size={14} color={colors.ink} />} style={{ marginTop: 16, alignSelf: 'flex-start' }} onPress={() => router.push('/profile-edit')} />
                : authed ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                    <Button title="Report" size="sm" variant="outline" icon={<Flag size={14} color={colors.ink} />} onPress={() => setReport(true)} />
                    <Button title="Block" size="sm" variant="danger" icon={<Ban size={14} color={colors.danger} />} onPress={block} />
                  </View>
                ) : null}
            </ProfileHeader>
            <T v="title">Listings</T>
            <UserListings userId={id} own={me} />
            <T v="title">Reviews</T>
            <UserReviews userId={id} />
          </ScrollView>
        )}
      {q.data ? <ReportSheet open={report} onClose={() => setReport(false)} targetType="USER" targetId={id} subject={q.data.displayName} /> : null}
    </View>
  );
}
