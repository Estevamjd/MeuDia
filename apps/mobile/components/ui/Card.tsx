import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../lib/colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'accent' | 'surface';
}

export function Card({ children, style, variant = 'default' }: CardProps) {
  const bgColor =
    variant === 'accent' ? colors.card2 :
    variant === 'surface' ? colors.surface :
    colors.card;

  return (
    <View style={[styles.card, { backgroundColor: bgColor }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 15,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
