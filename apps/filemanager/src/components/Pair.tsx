import React from "react";
import QRCode from "react-qr-code";

interface PairProps {
	id: string;
}

const Pair: React.FC<PairProps> = ({ id }) => {
	return (
		<div className="flex flex-col items-center justify-center min-h-[420px] p-6 bg-base-200 rounded-xl shadow-xl border max-w-md mx-auto">
			<h2 className="text-2xl font-bold mb-3 text-center">Scan to pair with FileShare</h2>
			{
				<div className="bg-white p-4 rounded-lg shadow mb-4 border">
					<QRCode value={id} size={200} bgColor="#fff" fgColor="#000" />
				</div>
			}
			<ul className="steps steps-vertical mb-6 w-full max-w-xs mx-auto">
				<li className="step step-primary text-left">Scan this QR code with your phone camera</li>
				<li className="step step-primary text-left">Tap the link to open FileShare</li>
			</ul>
			<p className="text-xs text-gray-500 mt-2 text-center">
				Pair your device securely to transfer files. This QR code is valid for this session only.
			</p>
		</div>
	);
};

export default Pair;
