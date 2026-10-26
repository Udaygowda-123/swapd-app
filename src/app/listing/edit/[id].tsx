import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListingForm } from '@/components/listing-form';
import { BackHeader, EmptyState, ErrorState, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import type { Listing } from '@/lib/types';
import { colors } from '@/theme/tokens';

/** Edit a listing (owner only, and only while ACTIVE — same rules as the web edit page). */
export default function EditListing() {
  const { id } = useLocalSearchParams<{ id: string }>(); const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ['listing', id, true], queryFn: () => api<Listing>(`/listings/${id}`) });
  const frame = (child: React.ReactNode) => <View style={{ flex: 1, paddingTop: insets.top }}><BackHeader label="Back to listing" />{child}</View>;
  if (q.isPending) return frame(<Loading />);
  if (q.isError) return frame(<ErrorState onRetry={() => q.refetch()} />);
  if (!q.data.isOwner) return frame(<EmptyState icon={<Lock size={28} color={colors.coralInk} />} title="You can only edit your own listings" />);
  if (q.data.status !== 'ACTIVE') return frame(<EmptyState icon={<Lock size={28} color={colors.coralInk} />} title="This listing can't be edited right now" body="Listings that are part of a deal, swapped or removed are locked." />);
  return <ListingForm listing={q.data} />;
}
