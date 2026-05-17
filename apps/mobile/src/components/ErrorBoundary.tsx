import React, { Component, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView style={styles.wrap} contentContainerStyle={styles.inner}>
          <Text style={styles.title}>앱 오류</Text>
          <Text style={styles.msg}>{this.state.error.message}</Text>
          <Text style={styles.hint}>
            Expo Go SDK와 프로젝트 SDK(52)가 맞는지, npm install 후 다시
            시작했는지 확인하세요. 터미널의 빨간 로그도 함께 봐 주세요.
          </Text>
          <Pressable
            style={styles.btn}
            onPress={() => this.setState({ error: null })}
          >
            <Text style={styles.btnText}>다시 시도</Text>
          </Pressable>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fef2f2" },
  inner: { padding: 24, paddingTop: 48 },
  title: { fontSize: 22, fontWeight: "800", color: "#991b1b" },
  msg: {
    marginTop: 12,
    fontSize: 14,
    color: "#7f1d1d",
    fontFamily: "monospace",
  },
  hint: { marginTop: 16, fontSize: 14, color: "#64748b", lineHeight: 22 },
  btn: {
    marginTop: 24,
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
