import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

export function Icon({ name, size = 22, color }: { name: AndroidSymbol; size?: number; color: ColorValue }) {
  return <SymbolView name={{ android: name }} size={size} tintColor={color} />;
}
