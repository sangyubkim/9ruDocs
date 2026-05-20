import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "li"; text: string }
  | { type: "spacer" };

function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1");
}

function parseLink(line: string): { label: string; url: string } | null {
  const m = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (!m) return null;
  return { label: m[1], url: m[2] };
}

export function parseMarkdownBody(body: string): Block[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      if (blocks.length && blocks[blocks.length - 1].type !== "spacer") {
        blocks.push({ type: "spacer" });
      }
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
    } else if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
    } else if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
    } else if (/^[-*]\s+/.test(line)) {
      blocks.push({ type: "li", text: line.replace(/^[-*]\s+/, "") });
    } else {
      blocks.push({ type: "p", text: line });
    }
  }

  return blocks;
}

function InlineText({ text }: { text: string }) {
  const link = parseLink(text);
  if (link) {
    const isLocation = text.includes("📍") || link.label.includes("📍");
    return (
      <Pressable
        onPress={() => void Linking.openURL(link.url)}
        style={isLocation ? styles.locLink : undefined}
      >
        <Text style={isLocation ? styles.locLinkText : styles.linkText}>
          {isLocation ? `📍 ${link.label.replace(/^📍\s*/, "")}` : link.label}
        </Text>
      </Pressable>
    );
  }

  const parts = text.split(/(\*\*.+?\*\*)/g);
  if (parts.length === 1) {
    return <Text style={styles.para}>{stripMarkdownInline(text)}</Text>;
  }

  return (
    <Text style={styles.para}>
      {parts.map((part, i) => {
        const bold = part.match(/^\*\*(.+)\*\*$/);
        if (bold) {
          return (
            <Text key={i} style={styles.bold}>
              {bold[1]}
            </Text>
          );
        }
        return <Text key={i}>{stripMarkdownInline(part)}</Text>;
      })}
    </Text>
  );
}

export function MarkdownPreviewBody({ body }: { body: string }) {
  const blocks = parseMarkdownBody(body);

  if (!body.trim()) {
    return <Text style={styles.empty}>본문이 비어 있습니다.</Text>;
  }

  return (
    <View style={styles.body}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h1":
            return (
              <Text key={i} style={styles.h1}>
                {stripMarkdownInline(block.text)}
              </Text>
            );
          case "h2":
            return (
              <Text key={i} style={styles.h2}>
                {stripMarkdownInline(block.text)}
              </Text>
            );
          case "h3":
            return (
              <Text key={i} style={styles.h3}>
                {stripMarkdownInline(block.text)}
              </Text>
            );
          case "li":
            return (
              <View key={i} style={styles.liRow}>
                <Text style={styles.bullet}>•</Text>
                <View style={styles.liContent}>
                  <InlineText text={block.text} />
                </View>
              </View>
            );
          case "spacer":
            return <View key={i} style={styles.spacer} />;
          default:
            return (
              <View key={i} style={styles.pBlock}>
                <InlineText text={block.text} />
              </View>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 4 },
  empty: { color: "#94a3b8", fontStyle: "italic", fontSize: 15 },
  h1: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 8,
    marginBottom: 4,
  },
  h2: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1e293b",
    marginTop: 10,
    marginBottom: 4,
  },
  h3: {
    fontSize: 17,
    fontWeight: "700",
    color: "#334155",
    marginTop: 8,
    marginBottom: 2,
  },
  pBlock: { marginVertical: 2 },
  para: { fontSize: 16, lineHeight: 26, color: "#334155" },
  bold: { fontWeight: "700" },
  liRow: { flexDirection: "row", gap: 8, marginVertical: 2 },
  bullet: { fontSize: 16, lineHeight: 26, color: "#64748b" },
  liContent: { flex: 1 },
  spacer: { height: 8 },
  linkText: { fontSize: 16, lineHeight: 26, color: "#2563eb" },
  locLink: {
    alignSelf: "flex-start",
    marginVertical: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  locLinkText: { fontSize: 15, fontWeight: "600", color: "#1d4ed8" },
});
