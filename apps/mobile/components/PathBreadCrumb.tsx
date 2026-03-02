import React, { useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';

type Props = {
  path: string;
  onPathChange: (newPath: string) => void;
};

const ROOT_PATH = '/storage/emulated/0';

export default function PathBreadcrumb({ path, onPathChange }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  const segments = useMemo(() => {
    if (!path.startsWith(ROOT_PATH)) return [];

    const rest = path.replace(ROOT_PATH, '').split('/').filter(Boolean);

    return [
      { label: 'Internal Storage', fullPath: ROOT_PATH },
      ...rest.map((name, index) => ({
        label: name,
        fullPath: `${ROOT_PATH}/${rest.slice(0, index + 1).join('/')}`,
      })),
    ];
  }, [path]);

  return (
    <View className="py-2">
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {segments.map((seg, index) => (
          <View key={seg.fullPath} className="flex-row items-center">
            <TouchableOpacity onPress={() => onPathChange(seg.fullPath)}>
              <Text className="text-sm font-medium text-primary">{seg.label}</Text>
            </TouchableOpacity>

            {index < segments.length - 1 && (
              <Text className="mx-1 text-lg text-muted-foreground">›</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
