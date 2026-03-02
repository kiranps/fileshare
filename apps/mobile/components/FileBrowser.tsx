import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Folder } from 'lucide-react-native';
import RNFS from 'react-native-fs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { interopIcon } from '@/utils/css';
import PathBreadcrumb from './PathBreadCrumb';

type Directory = {
  name: string;
  path: string;
};

interface FileBrowserProps {
  rootPath: string;
  setRootPath: (path: string) => void;
}

export default function FileBrowser({ rootPath, setRootPath }: FileBrowserProps) {
  const [path, setPath] = useState<string>(rootPath);
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
        console.error('Failed to load directories:', err);
      }
    }
    loadDirectories();
  }, [path]);

  const handleDirectoryPress = (dir: Directory) => {
    console.log(dir.path.split('/'));
    setPath(dir.path);
  };

  // allow lucide icons to receive className via nativewind
  interopIcon(Folder);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="flex-1 px-4 pt-6">
        <Text className="mb-3 text-xl font-medium text-foreground">Internal Storage</Text>
        <PathBreadcrumb path={path} onPathChange={setPath} />
        <View className="flex-1">
          <FlatList
            data={directories}
            keyExtractor={(item) => item.path}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="flex-row items-center border-b border-border py-3"
                onPress={() => handleDirectoryPress(item)}>
                <Folder size={22} className="text-primary" strokeWidth={1.8} />
                <Text className="ml-4 text-base text-foreground">{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
        <TouchableOpacity
          className="my-3 w-full flex-row items-center justify-center gap-3 rounded-xl bg-primary py-4"
          onPress={() => setRootPath(path)}>
          <Text className="text-base font-semibold text-white">Set Shared Folder</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
