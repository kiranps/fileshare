import { FileManager } from "@components/FileManager";
import { useEffect } from "react";

function App() {
	useEffect(() => {
		const disableRightClick = (e: MouseEvent) => {
			e.preventDefault();
		};
		document.addEventListener("contextmenu", disableRightClick);
		return () => {
			document.removeEventListener("contextmenu", disableRightClick);
		};
	}, []);
	return <FileManager />;
}

export default App;
