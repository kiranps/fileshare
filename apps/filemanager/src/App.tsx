import { FileManager } from "@components/FileManager";
import Pair from "@components/Pair";
import { useEffect, useState } from "react";
import { useFileManagerStore } from "./store/useFileManagerStore";
import { p2p } from "./utils/p2p_client";

function App() {
	const [paired, setPaired] = useState(false);
	const [qrID, setQRID] = useState<null | string>(null);
	const { sessionId, setSessionId } = useFileManagerStore();

	useEffect(() => {
		const disableRightClick = (e: MouseEvent) => {
			e.preventDefault();
		};
		document.addEventListener("contextmenu", disableRightClick);
		return () => {
			document.removeEventListener("contextmenu", disableRightClick);
		};
	}, []);

	useEffect(() => {
		const handleUnload = () => {
			p2p.closeSession();
		};
		window.addEventListener("unload", handleUnload);
		return () => {
			window.removeEventListener("unload", handleUnload);
		};
	}, []);

	useEffect(() => {
		console.log(sessionId);
		const conn = p2p.startSession(sessionId ?? undefined, ["file"]);

		conn.on("session", (sid) => {
			console.log("session:", sid);
			setSessionId(sid);
			setQRID(sid);
		});

		conn.on("ready", async () => {
			console.log("ready");
			setPaired(true);
			//const result = await conn.request("fs.list", { path: "Downloads" });
			//console.log(result);
		});

		conn.on("close", () => {});
		conn.on("error", (err) => {});
	}, []);

	//const handlePaired = useCallback((ip: string, port: string) => {
	//const host = `http://${ip}:${port}`;
	//setWebDAVHost(host);
	//setPaired(true);
	//}, []);

	return paired ? <FileManager /> : qrID && <Pair id={qrID} />;
}

export default App;
