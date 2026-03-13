import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InputModal from "./FileListModal";

const defaultProps = {
	open: true,
	title: "New Folder",
	label: "Folder name",
	placeholder: "folder name",
	value: "",
	onChange: vi.fn(),
	onSubmit: vi.fn(),
	onCancel: vi.fn(),
};

describe("InputModal", () => {
	describe("conditional rendering", () => {
		it("renders nothing when open is false", () => {
			const { container } = render(<InputModal {...defaultProps} open={false} />);
			expect(container).toBeEmptyDOMElement();
		});

		it("renders dialog when open is true", () => {
			render(<InputModal {...defaultProps} />);
			expect(screen.getByRole("dialog")).toBeInTheDocument();
		});
	});

	describe("content rendering", () => {
		it("renders the title", () => {
			render(<InputModal {...defaultProps} title="Create Folder" />);
			expect(screen.getByText("Create Folder")).toBeInTheDocument();
		});

		it("renders the label", () => {
			render(<InputModal {...defaultProps} label="Directory name" />);
			expect(screen.getByText("Directory name")).toBeInTheDocument();
		});

		it("renders the input with placeholder", () => {
			render(<InputModal {...defaultProps} placeholder="enter name here" />);
			expect(screen.getByPlaceholderText("enter name here")).toBeInTheDocument();
		});

		it("renders the input with the provided value", () => {
			render(<InputModal {...defaultProps} value="my-folder" />);
			expect(screen.getByDisplayValue("my-folder")).toBeInTheDocument();
		});

		it("renders default submit button label 'Create'", () => {
			render(<InputModal {...defaultProps} />);
			expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
		});

		it("renders custom submit label", () => {
			render(<InputModal {...defaultProps} submitLabel="Rename" />);
			expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument();
		});

		it("renders a Cancel button", () => {
			render(<InputModal {...defaultProps} />);
			expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
		});

		it("renders backdrop button with aria-label", () => {
			render(<InputModal {...defaultProps} />);
			expect(screen.getByRole("button", { name: "Close modal" })).toBeInTheDocument();
		});
	});

	describe("loading state", () => {
		it("shows loading text when isLoading is true", () => {
			render(<InputModal {...defaultProps} isLoading={true} />);
			expect(screen.getByText("Please wait...")).toBeInTheDocument();
		});

		it("does not show loading text when isLoading is false", () => {
			render(<InputModal {...defaultProps} isLoading={false} />);
			expect(screen.queryByText("Please wait...")).not.toBeInTheDocument();
		});

		it("disables input when isLoading is true", () => {
			render(<InputModal {...defaultProps} isLoading={true} />);
			expect(screen.getByRole("textbox")).toBeDisabled();
		});

		it("disables submit button when isLoading is true", () => {
			render(<InputModal {...defaultProps} isLoading={true} value="test" />);
			expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
		});

		it("disables cancel button when isLoading is true", () => {
			render(<InputModal {...defaultProps} isLoading={true} />);
			expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
		});
	});

	describe("error state", () => {
		it("shows error text when isError is true", () => {
			render(<InputModal {...defaultProps} isError={true} errorText="Something went wrong" />);
			expect(screen.getByText("Something went wrong")).toBeInTheDocument();
		});

		it("shows default error text when errorText is not provided", () => {
			render(<InputModal {...defaultProps} isError={true} />);
			expect(screen.getByText("Error occurred")).toBeInTheDocument();
		});

		it("does not show error text when isError is false", () => {
			render(<InputModal {...defaultProps} isError={false} errorText="Some error" />);
			expect(screen.queryByText("Some error")).not.toBeInTheDocument();
		});
	});

	describe("submit button disabled state", () => {
		it("disables submit button when value is empty", () => {
			render(<InputModal {...defaultProps} value="" />);
			expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
		});

		it("disables submit button when value is only whitespace", () => {
			render(<InputModal {...defaultProps} value="   " />);
			expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
		});

		it("enables submit button when value has content", () => {
			render(<InputModal {...defaultProps} value="my-folder" />);
			expect(screen.getByRole("button", { name: "Create" })).not.toBeDisabled();
		});
	});

	describe("callbacks", () => {
		it("calls onChange when input value changes", () => {
			const onChange = vi.fn();
			render(<InputModal {...defaultProps} onChange={onChange} />);
			fireEvent.change(screen.getByRole("textbox"), { target: { value: "new-name" } });
			expect(onChange).toHaveBeenCalledWith("new-name");
		});

		it("calls onSubmit when submit button clicked", () => {
			const onSubmit = vi.fn();
			render(<InputModal {...defaultProps} onSubmit={onSubmit} value="folder-name" />);
			fireEvent.click(screen.getByRole("button", { name: "Create" }));
			expect(onSubmit).toHaveBeenCalledTimes(1);
		});

		it("calls onCancel when Cancel button clicked", () => {
			const onCancel = vi.fn();
			render(<InputModal {...defaultProps} onCancel={onCancel} />);
			fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
			expect(onCancel).toHaveBeenCalledTimes(1);
		});

		it("calls onCancel when backdrop is clicked", () => {
			const onCancel = vi.fn();
			render(<InputModal {...defaultProps} onCancel={onCancel} />);
			fireEvent.click(screen.getByRole("button", { name: "Close modal" }));
			expect(onCancel).toHaveBeenCalledTimes(1);
		});

		it("calls onSubmit when Enter key is pressed with non-empty value", () => {
			const onSubmit = vi.fn();
			render(<InputModal {...defaultProps} onSubmit={onSubmit} value="folder-name" />);
			fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
			expect(onSubmit).toHaveBeenCalledTimes(1);
		});

		it("does not call onSubmit when Enter key is pressed with empty value", () => {
			const onSubmit = vi.fn();
			render(<InputModal {...defaultProps} onSubmit={onSubmit} value="" />);
			fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it("does not call onSubmit for other key presses", () => {
			const onSubmit = vi.fn();
			render(<InputModal {...defaultProps} onSubmit={onSubmit} value="folder" />);
			fireEvent.keyDown(screen.getByRole("textbox"), { key: "a" });
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it("calls onCancel when Escape key pressed on backdrop", () => {
			const onCancel = vi.fn();
			render(<InputModal {...defaultProps} onCancel={onCancel} />);
			fireEvent.keyDown(screen.getByRole("button", { name: "Close modal" }), { key: "Escape" });
			expect(onCancel).toHaveBeenCalledTimes(1);
		});

		it("does not call onCancel for other key presses on backdrop", () => {
			const onCancel = vi.fn();
			render(<InputModal {...defaultProps} onCancel={onCancel} />);
			fireEvent.keyDown(screen.getByRole("button", { name: "Close modal" }), { key: "Enter" });
			expect(onCancel).not.toHaveBeenCalled();
		});
	});

	describe("autoFocus", () => {
		it("input receives focus on mount", () => {
			render(<InputModal {...defaultProps} />);
			// React's autoFocus prop focuses the element on mount in jsdom
			// (jsdom does not set the HTML `autofocus` attribute, but does focus the element)
			const input = screen.getByRole("textbox");
			expect(input).toHaveFocus();
		});
	});

	describe("rename modal variant", () => {
		it("renders with rename title and label", () => {
			render(
				<InputModal
					open={true}
					title="Rename"
					label="New name"
					placeholder="old-name.txt"
					value="old-name.txt"
					onChange={vi.fn()}
					onSubmit={vi.fn()}
					onCancel={vi.fn()}
					submitLabel="Rename"
				/>,
			);
			// "Rename" appears as both the <h3> title and the submit button label
			expect(screen.getByRole("heading", { name: "Rename" })).toBeInTheDocument();
			expect(screen.getByText("New name")).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument();
		});
	});
});
