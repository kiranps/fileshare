import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useFileManagerStore } from "./useFileManagerStore";

describe("useFileManagerStore", () => {
	beforeEach(() => {
		// Reset to known state before each test
		useFileManagerStore.setState({ activePath: "/" });
	});

	describe("initial state", () => {
		it("has a non-empty activePath", () => {
			const state = useFileManagerStore.getState();
			expect(state.activePath).toBeTruthy();
		});

		it("activePath is a string", () => {
			const state = useFileManagerStore.getState();
			expect(typeof state.activePath).toBe("string");
		});

		it("has setActivePath function", () => {
			const state = useFileManagerStore.getState();
			expect(typeof state.setActivePath).toBe("function");
		});
	});

	describe("setActivePath", () => {
		it("updates activePath to the given value", () => {
			act(() => {
				useFileManagerStore.getState().setActivePath("/Documents");
			});
			expect(useFileManagerStore.getState().activePath).toBe("/Documents");
		});

		it("updates activePath to root '/'", () => {
			act(() => {
				useFileManagerStore.getState().setActivePath("/some/path");
			});
			act(() => {
				useFileManagerStore.getState().setActivePath("/");
			});
			expect(useFileManagerStore.getState().activePath).toBe("/");
		});

		it("updates activePath to a nested path", () => {
			act(() => {
				useFileManagerStore.getState().setActivePath("/Documents/Reports/2024");
			});
			expect(useFileManagerStore.getState().activePath).toBe("/Documents/Reports/2024");
		});

		it("replaces previous activePath", () => {
			act(() => {
				useFileManagerStore.getState().setActivePath("/first");
			});
			act(() => {
				useFileManagerStore.getState().setActivePath("/second");
			});
			expect(useFileManagerStore.getState().activePath).toBe("/second");
		});

		it("updates to URL-encoded path", () => {
			act(() => {
				useFileManagerStore.getState().setActivePath("/My%20Documents");
			});
			expect(useFileManagerStore.getState().activePath).toBe("/My%20Documents");
		});
	});

	describe("store setState (for testing)", () => {
		it("allows direct state reset via setState", () => {
			useFileManagerStore.setState({ activePath: "/custom-path" });
			expect(useFileManagerStore.getState().activePath).toBe("/custom-path");
		});
	});
});
