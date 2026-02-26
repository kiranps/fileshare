import React from "react";
import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Folder } from "lucide-react-native";
import RNFS from "react-native-fs";
import { SafeAreaView } from "react-native-safe-area-context";
import PathBreadcrumb from "./PathBreadCrumb";

type Directory = {
  name: string;
  path: string;
};

export default function InternalStorageScreen() {
  const [path, setPath] = useState<string>("/storage/emulated/0");
  const [directories, setDirectories] = useState<Directory[]>([]);

  useEffect(() => {
    async function loadDirectories() {
      try {
        const files = await RNFS.readDir(path);
        const dirs = files
          .filter((f) => f.isDirectory())
          .map((f) => ({ name: f.name, path: f.path }));
        setDirectories(dirs);
      } catch (err) {
        console.error("Failed to load directories:", err);
      }
    }
    loadDirectories();
  }, [path]);

  const handleDirectoryPress = (dir: Directory) => {
    console.log(dir.path.split("/"));
    setPath(dir.path);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.heading}>Internal Storage</Text>
        <PathBreadcrumb path={path} onPathChange={setPath} />
        <View style={styles.listContainer}>
          <FlatList
            data={directories}
            keyExtractor={(item) => item.path}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => handleDirectoryPress(item)}
              >
                <Folder size={22} color="#2563eb" strokeWidth={1.8} />
                <Text style={styles.folderName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
        <TouchableOpacity style={styles.bottomButton}>
          <Text style={styles.bottomButtonText}>Scan Storage</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  heading: {
    fontSize: 20,
    fontWeight: "500",
    marginBottom: 12,
    color: "#111827",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 26,
  },
  listContainer: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  folderName: {
    marginLeft: 14,
    fontSize: 16,
    color: "#1f2937",
  },
  bottomButton: {
    height: 52,
    marginVertical: 12,
    backgroundColor: "#2563eb",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
