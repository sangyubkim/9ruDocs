import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MapProvider } from "../types";

type Props = {
  value: MapProvider;
  onChange: (provider: MapProvider) => void;
};

export function MapProviderRadio({ value, onChange }: Props) {
  const options: { id: MapProvider; label: string }[] = [
    { id: "google", label: "구글 지도" },
    { id: "naver", label: "네이버 지도" },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>지도 연동</Text>
      <View style={styles.row}>
        {options.map((opt) => {
          const selected = value === opt.id;
          return (
            <Pressable
              key={opt.id}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => onChange(opt.id)}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
              <Text style={[styles.label, selected && styles.labelSelected]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  title: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  option: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  optionSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: "#2563eb" },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563eb",
  },
  label: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  labelSelected: { color: "#1d4ed8" },
});
