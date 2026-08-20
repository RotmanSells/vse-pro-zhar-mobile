import { StyleSheet, Text, View } from 'react-native';

export function MobileShell(): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Все Про Жар
      </Text>
      <Text>Мобильное приложение готово к запуску.</Text>
    </View>
  );
}

export default function MobileShellRoute(): React.ReactElement {
  return <MobileShell />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
  },
});
