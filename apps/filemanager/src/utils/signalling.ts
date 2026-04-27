const BASE_URL = import.meta.env.VITE_SIGNALLING_SERVER_URL || "http://localhost:9000";

export interface SessionResponse {
	session_id: string;
}

export async function createSession(): Promise<string> {
	const res = await fetch(`${BASE_URL}/session`, { method: "POST" });
	if (!res.ok) throw new Error(`createSession failed: ${res.status}`);
	const data: SessionResponse = await res.json();
	return data.session_id;
}

export async function postOffer(sessionId: string, sdp: string): Promise<void> {
	const res = await fetch(`${BASE_URL}/session/${sessionId}/offer`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: sdp,
	});
	if (!res.ok) throw new Error(`postOffer failed: ${res.status}`);
}

export async function resetSession(sessionId: string): Promise<void> {
	const res = await fetch(`${BASE_URL}/session/${sessionId}/reset`, {
		method: "POST",
	});
	if (!res.ok) throw new Error(`resetSession failed: ${res.status}`);
}

export type SessionState = "open" | "closed";

export interface SessionInfo {
	session_id: string;
	state: SessionState;
}

export async function getSession(sessionId: string): Promise<SessionInfo> {
	const res = await fetch(`${BASE_URL}/session/${sessionId}`);
	if (!res.ok) throw new Error(`getSession failed: ${res.status}`);
	return res.json() as Promise<SessionInfo>;
}

export async function closeSession(sessionId: string): Promise<void> {
	const res = await fetch(`${BASE_URL}/session/${sessionId}/close`, {
		method: "POST",
	});
	if (!res.ok) throw new Error(`closeSession failed: ${res.status}`);
}

export async function pollAnswer(
	sessionId: string,
	intervalMs = 5000,
	timeoutMs = 60000,
	maxConsecutiveFailures = 5,
): Promise<any> {
	await new Promise((r) => setTimeout(r, 5000));
	const deadline = Date.now() + timeoutMs;
	let consecutiveFailures = 0;
	while (Date.now() < deadline) {
		const res = await fetch(`${BASE_URL}/session/${sessionId}/answer`);
		if (res.ok) {
			const data = await res.json();
			if (data.sdp) return data;
			consecutiveFailures = 0;
		} else {
			consecutiveFailures++;
			if (consecutiveFailures >= maxConsecutiveFailures) {
				throw new Error(`pollAnswer failed ${maxConsecutiveFailures} consecutive times (last status: ${res.status})`);
			}
		}
		await new Promise((r) => setTimeout(r, intervalMs));
	}
	throw new Error("Timed out waiting for answer");
}
