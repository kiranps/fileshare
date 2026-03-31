import { FileManager } from "@components/FileManager";
import Pair from "@components/Pair";
import { useCallback, useEffect, useState } from "react";
import { setWebDAVHost } from "./api/webdav";

function App() {
	const [paired, setPaired] = useState(false);

	useEffect(() => {
		const disableRightClick = (e: MouseEvent) => {
			e.preventDefault();
		};
		document.addEventListener("contextmenu", disableRightClick);
		return () => {
			document.removeEventListener("contextmenu", disableRightClick);
		};
	}, []);

	const handlePaired = useCallback((ip: string, port: string) => {
		const host = `http://${ip}:${port}`;
		setWebDAVHost(host);
		setPaired(true);
	}, []);

	return paired ? <FileManager /> : <Pair onPaired={handlePaired} />;
}

export default App;
