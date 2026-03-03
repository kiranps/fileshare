import React from "react";

export type ModalProps = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
};

export const Modal: React.FC<ModalProps> = ({ open, title, children, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50">
      <div className="bg-base-100 rounded shadow-lg p-6 min-w-[320px] max-w-[90vw]">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};
