import { memo, useCallback, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { BlogDraft } from "../types";
import { draftDisplayTitle } from "../storage/draftStorage";

const DRAWER_WIDTH = Math.min(260, Dimensions.get("window").width * 0.72);
export const DRAWER_TAB_WIDTH = 18;

const CLOSED_X = -DRAWER_WIDTH;
const OPEN_THRESHOLD = 32;
const VELOCITY_THRESHOLD = 0.18;
const ANIM_DURATION = 240;

type Props = {
  drafts: BlogDraft[];
  activeId: string;
  checkedIds: Set<string>;
  children: ReactNode;
  onSelectDraft: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onDeleteChecked: () => void;
  onNewDraft: () => void;
};

const DrawerContent = memo(function DrawerContent({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <View style={styles.content} collapsable={false}>
      {children}
    </View>
  );
});

const DrawerPanel = memo(function DrawerPanel({
  drafts,
  activeId,
  checkedIds,
  onSelectDraft,
  onToggleCheck,
  onDeleteChecked,
  onNewDraft,
}: Omit<Props, "children">) {
  const sorted = useMemo(
    () =>
      [...drafts].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [drafts],
  );

  return (
    <>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerTitle}>작성 중</Text>
        <Pressable style={styles.newBtn} onPress={onNewDraft}>
          <Text style={styles.newBtnText}>+ 새 글</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      >
        {sorted.map((d) => {
          const active = d.id === activeId;
          const checked = checkedIds.has(d.id);
          const tpl = d.template === "restaurant" ? "맛집" : "기본";
          return (
            <View
              key={d.id}
              style={[styles.item, active && styles.itemActive]}
            >
              <Pressable
                style={styles.checkBox}
                onPress={() => onToggleCheck(d.id)}
                hitSlop={8}
              >
                <Text style={styles.checkMark}>{checked ? "☑" : "☐"}</Text>
              </Pressable>
              <Pressable
                style={styles.itemBody}
                onPress={() => onSelectDraft(d.id)}
              >
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {draftDisplayTitle(d)}
                </Text>
                <Text style={styles.itemMeta}>
                  {tpl} · {new Date(d.updatedAt).toLocaleDateString("ko-KR")}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <Pressable
        style={[
          styles.deleteBtn,
          checkedIds.size === 0 && styles.deleteBtnDisabled,
        ]}
        disabled={checkedIds.size === 0}
        onPress={onDeleteChecked}
      >
        <Text style={styles.deleteBtnText}>
          삭제 {checkedIds.size > 0 ? `(${checkedIds.size})` : ""}
        </Text>
      </Pressable>
    </>
  );
});

export function DraftDrawer({
  drafts,
  activeId,
  checkedIds,
  children,
  onSelectDraft,
  onToggleCheck,
  onDeleteChecked,
  onNewDraft,
}: Props) {
  const slide = useRef(new Animated.Value(CLOSED_X)).current;
  const openRef = useRef(false);
  const animatingRef = useRef(false);
  const backdropRef = useRef<View>(null);
  const drawerPanelRef = useRef<View>(null);

  const setLayerInteraction = useCallback((interactive: boolean) => {
    backdropRef.current?.setNativeProps({
      pointerEvents: interactive ? "auto" : "none",
    });
    drawerPanelRef.current?.setNativeProps({
      pointerEvents: interactive ? "auto" : "none",
    });
  }, []);

  const animateTo = useCallback(
    (toOpen: boolean) => {
      animatingRef.current = true;
      if (toOpen) {
        setLayerInteraction(true);
      } else {
        setLayerInteraction(false);
      }

      slide.stopAnimation((currentValue) => {
        slide.setOffset(0);
        slide.setValue(currentValue);

        Animated.timing(slide, {
          toValue: toOpen ? 0 : CLOSED_X,
          duration: ANIM_DURATION,
          easing: toOpen
            ? Easing.out(Easing.cubic)
            : Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          animatingRef.current = false;
          if (!finished) return;
          openRef.current = toOpen;
          slide.setValue(toOpen ? 0 : CLOSED_X);
        });
      });
    },
    [setLayerInteraction, slide],
  );

  const toggleDrawer = useCallback(() => {
    animateTo(!openRef.current);
  }, [animateTo]);

  const backdropOpacity = slide.interpolate({
    inputRange: [CLOSED_X, 0],
    outputRange: [0, 0.3],
    extrapolate: "clamp",
  });

  const arrowClosedOpacity = slide.interpolate({
    inputRange: [CLOSED_X, CLOSED_X + 24],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const arrowOpenOpacity = slide.interpolate({
    inputRange: [CLOSED_X + 24, 0],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const commitOpen = useCallback(
    (toOpen: boolean) => {
      animateTo(toOpen);
    },
    [animateTo],
  );

  const createDragHandlers = useCallback(
    (opts: { edgeOnly: boolean }) =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => {
          if (animatingRef.current) return false;
          if (Math.abs(g.dx) < 5) return false;
          if (Math.abs(g.dx) < Math.abs(g.dy) * 1.15) return false;
          if (!openRef.current && g.dx > 0) return true;
          if (openRef.current && g.dx < 0) return true;
          return false;
        },
        onMoveShouldSetPanResponderCapture: (_, g) => {
          if (animatingRef.current) return false;
          if (opts.edgeOnly) {
            if (
              !openRef.current &&
              g.dx > 2 &&
              Math.abs(g.dx) >= Math.abs(g.dy)
            ) {
              return true;
            }
            return false;
          }
          if (Math.abs(g.dx) < 6) return false;
          if (Math.abs(g.dx) < Math.abs(g.dy) * 1.2) return false;
          if (!openRef.current && g.dx > 0) return true;
          if (openRef.current && g.dx < 0) return true;
          return false;
        },
        onPanResponderGrant: () => {
          if (animatingRef.current) return;
          slide.stopAnimation((value) => {
            slide.setOffset(value);
            slide.setValue(0);
          });
        },
        onPanResponderMove: (_, g) => {
          if (animatingRef.current) return;
          const base = openRef.current ? 0 : CLOSED_X;
          let next = g.dx;
          if (!openRef.current) {
            next = Math.min(-base, Math.max(CLOSED_X - base, g.dx));
          } else {
            next = Math.max(CLOSED_X - base, Math.min(-base, g.dx));
          }
          slide.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          if (animatingRef.current) return;
          const wasOpen = openRef.current;
          slide.flattenOffset();
          const { dx, vx } = g;

          if (!wasOpen) {
            commitOpen(dx > OPEN_THRESHOLD || vx > VELOCITY_THRESHOLD);
            return;
          }
          commitOpen(!(dx < -OPEN_THRESHOLD || vx < -VELOCITY_THRESHOLD));
        },
        onPanResponderTerminate: () => {
          if (animatingRef.current) return;
          slide.flattenOffset();
          animateTo(openRef.current);
        },
      }),
    [animateTo, commitOpen, slide],
  );

  const edgePan = useRef(createDragHandlers({ edgeOnly: true })).current;
  const globalPan = useRef(createDragHandlers({ edgeOnly: false })).current;

  const handleSelect = useCallback(
    (id: string) => {
      onSelectDraft(id);
      if (openRef.current) animateTo(false);
    },
    [animateTo, onSelectDraft],
  );

  const closeDrawer = useCallback(() => {
    animateTo(false);
  }, [animateTo]);

  return (
    <View style={styles.root} {...globalPan.panHandlers}>
      <DrawerContent>{children}</DrawerContent>

      <Animated.View
        ref={backdropRef}
        style={[styles.backdrop, { opacity: backdropOpacity }]}
        pointerEvents="none"
        collapsable={false}
      >
        <Pressable style={styles.backdropPress} onPress={closeDrawer} />
      </Animated.View>

      <Animated.View
        style={[styles.drawerShell, { transform: [{ translateX: slide }] }]}
        pointerEvents="box-none"
        collapsable={false}
      >
        <View
          ref={drawerPanelRef}
          style={styles.drawerPanel}
          pointerEvents="none"
          collapsable={false}
        >
          <DrawerPanel
            drafts={drafts}
            activeId={activeId}
            checkedIds={checkedIds}
            onSelectDraft={handleSelect}
            onToggleCheck={onToggleCheck}
            onDeleteChecked={onDeleteChecked}
            onNewDraft={onNewDraft}
          />
        </View>

        <Pressable
          style={styles.edgeTab}
          onPress={toggleDrawer}
          accessibilityLabel="글 목록"
          {...edgePan.panHandlers}
        >
          <Animated.Text
            style={[styles.edgeTabIcon, { opacity: arrowClosedOpacity }]}
          >
            ›
          </Animated.Text>
          <Animated.Text
            style={[
              styles.edgeTabIcon,
              styles.edgeTabIconOverlay,
              { opacity: arrowOpenOpacity },
            ]}
          >
            ‹
          </Animated.Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: "relative", overflow: "hidden" },
  content: { flex: 1, paddingLeft: DRAWER_TAB_WIDTH + 6 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.3)",
    zIndex: 10,
  },
  backdropPress: { flex: 1 },
  drawerShell: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH + DRAWER_TAB_WIDTH,
    zIndex: 20,
  },
  drawerPanel: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: "#fff",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#e2e8f0",
  },
  edgeTab: {
    position: "absolute",
    left: DRAWER_WIDTH,
    top: "42%",
    marginTop: -22,
    width: DRAWER_TAB_WIDTH,
    height: 44,
    backgroundColor: "#e2e8f0",
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 0,
    borderColor: "#cbd5e1",
  },
  edgeTabIcon: {
    color: "#475569",
    fontWeight: "800",
    fontSize: 14,
    lineHeight: 16,
  },
  edgeTabIconOverlay: {
    position: "absolute",
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  drawerTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  newBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
  },
  newBtnText: { color: "#2563eb", fontWeight: "700", fontSize: 13 },
  list: { flex: 1 },
  listContent: { padding: 8, gap: 6 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
    backgroundColor: "#fafafa",
    overflow: "hidden",
  },
  itemActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  checkBox: {
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  checkMark: { fontSize: 18, color: "#334155" },
  itemBody: { flex: 1, paddingVertical: 10, paddingRight: 10 },
  itemTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  itemMeta: { marginTop: 4, fontSize: 11, color: "#94a3b8" },
  deleteBtn: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#fee2e2",
    alignItems: "center",
  },
  deleteBtnDisabled: { opacity: 0.45 },
  deleteBtnText: { color: "#b91c1c", fontWeight: "700", fontSize: 15 },
});
