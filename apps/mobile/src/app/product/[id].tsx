import { useLocalSearchParams } from 'expo-router';

import { MobileProductDetailsRoot } from '../../mobile-health-root.tsx';

export default function ProductDetailsRoute(): React.ReactElement {
  const { id } = useLocalSearchParams<{ readonly id?: string | string[] }>();
  const productId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
  return <MobileProductDetailsRoot productId={productId} />;
}
