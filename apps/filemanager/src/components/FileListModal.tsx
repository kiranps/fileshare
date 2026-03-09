type InputModalProps = {
  open: boolean;
  title: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
  isLoading?: boolean;
  isError?: boolean;
  errorText?: string;
};

const InputModal: React.FC<InputModalProps> = ({
  open,
  title,
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = "Create",
  isLoading,
  isError,
  errorText,
}) =>
  open ? (
    <dialog className="modal" open>
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">{title}</h3>
        <label className="form-control w-full mb-4">
          <span className="label-text mb-1">{label}</span>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoFocus
            disabled={isLoading}
          />
        </label>
        {isLoading && <div className="my-2 text-primary">Please wait...</div>}
        {isError && (
          <div className="my-2 text-error">{errorText || "Error occurred"}</div>
        )}
        <div className="modal-action">
          <button
            className="btn btn-primary"
            onClick={onSubmit}
            disabled={isLoading || !value.trim()}
          >
            {submitLabel}
          </button>
          <button className="btn" onClick={onCancel} disabled={isLoading}>
            Cancel
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onCancel} />
    </dialog>
  ) : null;

export default InputModal;
