import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

type Props = Omit<TextInputProps, "value" | "onChangeText"> & {
  prefix: string;
  value: string;
  onChangeText: (text: string) => void;
  containerStyle?: object;
  large?: boolean;
};

/** 옅은 색 prefix + 사용자 입력 (prefix는 항상 표시, 값에 포함되지 않음) */
export function PrefixedFieldInput({
  prefix,
  value,
  onChangeText,
  containerStyle,
  style,
  large = false,
  ...rest
}: Props) {
  return (
    <View style={[styles.row, containerStyle]}>
      <Text
        style={[styles.prefix, large && styles.prefixLarge]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {prefix}
      </Text>
      <TextInput
        {...rest}
        style={[styles.input, style]}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  prefix: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
    marginRight: 4,
    flexShrink: 0,
    includeFontPadding: false,
  },
  prefixLarge: {
    fontSize: 18,
    fontWeight: "700",
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontSize: 14,
    color: "#0f172a",
    includeFontPadding: false,
  },
});
