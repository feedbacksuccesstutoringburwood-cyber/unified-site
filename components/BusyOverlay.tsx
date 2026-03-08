import React from 'react';

export default function BusyOverlay({
  open,
  title = 'Working…',
  message,
  subtitle,
}: {
  open: boolean;
  title?: string;
  message?: string;
  /** Backwards/alternate prop name used by some pages. */
  subtitle?: string;
}) {
  if (!open) return null;

  const finalMessage = message ?? subtitle;

  return (
    <div className="busy-overlay" role="dialog" aria-modal="true">
      <div className="busy-overlay-card">
        <div className="busy-ring" aria-hidden="true">
          <div className="busy-ring-inner">ST</div>
        </div>
        <div className="busy-overlay-text">
          <div className="busy-overlay-title">{title}</div>
          {finalMessage ? <div className="busy-overlay-message">{finalMessage}</div> : null}
        </div>
      </div>
    </div>
  );
}
