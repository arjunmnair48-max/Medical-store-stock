import type { ReactNode } from 'react';

export default function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" style={wide ? { maxWidth: 700 } : undefined}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
