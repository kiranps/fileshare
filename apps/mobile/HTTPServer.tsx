import { Text, View, Button, StyleSheet } from "react-native";
import { useState } from "react";
import { WebDavServer } from "react-native-webdav-server";

export default function HTTPServer() {
  const [message, setMessage] = useState<string>("");
  const server = new WebDavServer(8080, "/storage/emulated/0");

  const handleStartServer = () => {
    server.start();
  };

  const handleStopServer = () => {
    server.stop();
  };

  return (
    <View style={styles.container}>
      <Text>Result: {message}</Text>
      <Button
        title="Start Kotlin Server"
        onPress={handleStartServer}
        color="green"
      />
      <Button
        title="Stop Kotlin Server"
        onPress={handleStopServer}
        color="red"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
