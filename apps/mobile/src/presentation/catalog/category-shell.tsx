import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

import {
  loadCategories,
  type CategoryListPort,
  type CategoryLoadFailureReason,
  type CategoryLoadResult,
} from '../../application/catalog/category.ts';

type CategoryState = { readonly kind: 'loading' } | CategoryLoadResult;

function errorMessage(reason: CategoryLoadFailureReason): string {
  switch (reason) {
    case 'configuration':
      return 'Категории: адрес backend API не настроен.';
    case 'invalid_response':
      return 'Категории: backend вернул некорректный ответ.';
    case 'timeout':
      return 'Категории: backend не ответил вовремя.';
    case 'network':
      return 'Категории: backend сейчас недоступен.';
    case 'http':
      return 'Категории: backend не смог загрузить данные.';
  }
}

export function MobileCategoryShell({
  categoryPort,
}: {
  readonly categoryPort: CategoryListPort;
}): React.ReactElement {
  const [state, setState] = useState<CategoryState>({ kind: 'loading' });

  function reload(): void {
    setState({ kind: 'loading' });
    void loadCategories(categoryPort).then(setState);
  }

  useEffect(() => {
    let mounted = true;
    void loadCategories(categoryPort).then((result) => {
      if (mounted) setState(result);
    });
    return () => {
      mounted = false;
    };
  }, [categoryPort]);

  return (
    <View style={styles.container} testID="category-catalog-state">
      <Text accessibilityRole="header" style={styles.title}>
        Categories
      </Text>
      {state.kind === 'loading' ? <Text>Загружаем категории…</Text> : null}
      {state.kind === 'failure' ? (
        <View>
          <Text accessibilityLabel="category-error">{errorMessage(state.reason)}</Text>
          <Button onPress={reload} title="Повторить" />
        </View>
      ) : null}
      {state.kind === 'loaded' ? (
        <View>
          {state.categories.length === 0 ? <Text>Категорий пока нет.</Text> : null}
          {state.categories.map((category) => (
            <Text key={category.id} testID={`category-${category.id}`}>
              {category.name}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    marginTop: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
});
