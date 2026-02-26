import * as IntentLauncher from "expo-intent-launcher";
import * as Application from "expo-application";
import InternalStorageScreen from "./InternalStorageScreen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HTTPServer from "./HTTPServer";

async function requestAllFilesAccess() {
  IntentLauncher.startActivityAsync(
    IntentLauncher.ActivityAction.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
    {
      data: `package:${Application.applicationId}`,
    },
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <HTTPServer />
    </SafeAreaProvider>
  );
}
//<InternalStorageScreen />
