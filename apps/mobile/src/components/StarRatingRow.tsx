import { Pressable, StyleSheet, Text, View } from "react-native";

const MAX = 5;

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

export function StarRatingRow({ label, value, onChange }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stars}>
        {Array.from({ length: MAX }, (_, i) => {
          const star = i + 1;
          const filled = star <= value;
          return (
            <Pressable
              key={star}
              style={styles.starBtn}
              onPress={() => onChange(star)}
              hitSlop={4}
              accessibilityLabel={`${label} ${star}점`}
            >
              <Text style={[styles.star, filled ? styles.starFilled : styles.starEmpty]}>
                ★
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  label: { fontSize: 14, fontWeight: "600", color: "#334155", minWidth: 72 },
  stars: { flexDirection: "row", gap: 2 },
  starBtn: { padding: 2 },
  star: { fontSize: 26, lineHeight: 30 },
  starFilled: { color: "#f59e0b" },
  starEmpty: { color: "#e2e8f0" },
});
