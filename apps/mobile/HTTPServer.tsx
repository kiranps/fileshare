import { Text, View, Button, StyleSheet } from "react-native";
import { useState } from "react";
import { startServer, stopServer } from "react-native-webdav-server";

export default function HTTPServer() {
  const [message, setMessage] = useState<string>("");

  const handleStartServer = () => {
    startServer(8080);
    //.then((x) => {
    //setMessage(x);
    //})
    //.catch((err) => {
    //setMessage(err.message);
    //});
  };

  const handleStopServer = () => {
    stopServer()
      .then((x) => {
        setMessage(x);
      })
      .catch((err) => {
        setMessage(err.message);
      });
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
