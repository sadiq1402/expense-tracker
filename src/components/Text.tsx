import { Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';

import { colors, fontFamily } from '@/theme';

// Every screen imports these instead of react-native's, so the font, ink colour and aligned figures apply app-wide
const base = { fontFamily, color: colors.ink, fontVariant: ['tabular-nums' as const] };

export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={[base, style]} />;
}

export function TextInput({ style, ...props }: TextInputProps) {
  return <RNTextInput placeholderTextColor={colors.muted} {...props} style={[base, style]} />;
}
