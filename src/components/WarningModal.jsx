import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function WarningModal({ isOpen, violationCount, onClose }) {
  if (!isOpen) return null;
  const max = 3;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-sm card text-center space-y-4" style={{ boxShadow: 'var(--shadow-float)' }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'var(--apple-red)' }}>
          <AlertTriangle className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-[17px] font-semibold">Focus Warning</h3>
          <p className="text-[13px] text-[var(--text-secondary)] mt-2 leading-relaxed">
            You left the exam window. This has been logged and reported to your instructor.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: max }).map((_, i) => (
            <div key={i} className="w-3 h-3 rounded-full" style={{ background: i < violationCount ? 'var(--apple-red)' : 'rgba(0,0,0,0.06)' }} />
          ))}
          <span className="text-[12px] font-bold ml-1" style={{ color: 'var(--apple-red)' }}>{violationCount}/{max}</span>
        </div>
        <p className="text-[12px] text-[var(--text-tertiary)]">
          {violationCount >= max - 1 ? 'Next violation auto-submits your exam.' : `${max - violationCount} warnings remaining.`}
        </p>
        <button onClick={onClose} className="w-full btn-danger py-2.5 text-[13px]">Return to Exam</button>
      </div>
    </div>
  );
}
