import { StyleSheet, View } from 'react-native';

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <View
        style={[
          styles.leaf,
          styles.left,
          { width: size * 0.39, height: size * 0.59 },
        ]}
      />
      <View
        style={[
          styles.leaf,
          styles.right,
          { width: size * 0.39, height: size * 0.59 },
        ]}
      />
      <View
        style={[
          styles.center,
          { width: size * 0.2, height: size * 0.2, borderRadius: size * 0.1 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaf: {
    position: 'absolute',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 40,
    borderBottomLeftRadius: 40,
  },
  left: {
    backgroundColor: '#4ade80',
    opacity: 0.8,
    transform: [{ rotate: '-30deg' }],
  },
  right: {
    backgroundColor: '#86efac',
    opacity: 0.6,
    transform: [{ rotate: '30deg' }],
  },
  center: { backgroundColor: '#fff', opacity: 0.9, marginTop: 4 },
});
