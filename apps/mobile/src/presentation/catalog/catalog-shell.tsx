import { useCallback, useState } from 'react';

import type { CategoryListPort } from '../../application/catalog/category.ts';
import type { ProductListPort } from '../../application/catalog/product.ts';
import { MobileCategoryShell } from './category-shell.tsx';
import { MobileProductShell } from './product-shell.tsx';

export function MobileCatalogShell({
  categoryPort,
  productPort,
}: {
  readonly categoryPort: CategoryListPort;
  readonly productPort?: ProductListPort | undefined;
}): React.ReactElement {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>();
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | undefined>();
  const selectCategory = useCallback((id: string, name: string): void => {
    setSelectedCategoryId(id);
    setSelectedCategoryName(name);
  }, []);

  return (
    <>
      <MobileCategoryShell
        categoryPort={categoryPort}
        onSelectCategory={selectCategory}
        selectedCategoryId={selectedCategoryId}
      />
      {productPort === undefined ? null : (
        <MobileProductShell
          productPort={productPort}
          selectedCategoryId={selectedCategoryId}
          selectedCategoryName={selectedCategoryName}
        />
      )}
    </>
  );
}
