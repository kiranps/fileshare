//import { FileManager } from "@components/FileManager";
import Pair from "@components/Pair";
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
	//return <FileManager />;
	return <Pair />;
}

export default App;
