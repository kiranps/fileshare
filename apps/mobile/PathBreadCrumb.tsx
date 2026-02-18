import React, { useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

type Props = {
  path: string;
  onPathChange: (newPath: string) => void;
};

const ROOT_PATH = "/storage/emulated/0";

export default function PathBreadcrumb({ path, onPathChange }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  const segments = useMemo(() => {
    if (!path.startsWith(ROOT_PATH)) return [];

    const rest = path.replace(ROOT_PATH, "").split("/").filter(Boolean);

    return [
      { label: "Internal Storage", fullPath: ROOT_PATH },
      ...rest.map((name, index) => ({
        label: name,
        fullPath: `${ROOT_PATH}/${rest.slice(0, index + 1).join("/")}`,
      })),
    ];
  }, [path]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content_container}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
      >
        {segments.map((seg, index) => (
          <View key={seg.fullPath} style={styles.segment}>
            <TouchableOpacity onPress={() => onPathChange(seg.fullPath)}>
              <Text style={styles.text}>{seg.label}</Text>
            </TouchableOpacity>

            {index < segments.length - 1 && (
              <Text style={styles.separator}>›</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
  content_container: {},
  segment: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
    color: "#2563eb",
  },
  separator: {
    marginHorizontal: 6,
    color: "#6b7280",
    fontSize: 16,
  },
});
