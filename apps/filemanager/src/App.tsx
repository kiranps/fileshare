import { useEffect } from "react";
import { FileManager } from "./components/FileManager";

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
