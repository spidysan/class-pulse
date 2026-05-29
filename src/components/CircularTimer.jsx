import React, { useEffect, useRef } from 'react';

export default function CircularTimer({ duration, onTimeUp, questionId }) {
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const rafRef = useRef(null);
  const audioRef = useRef(null);
  const hasEndedRef = useRef(false);

  useEffect(() => {
    hasEndedRef.current = false;
    startRef.current = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const remaining = Math.max(0, duration - elapsed);
      const ratio = remaining / duration;
      if (timerRef.current) {
        const circle = timerRef.current.querySelector('.timer-ring');
        const text = timerRef.current.querySelector('.timer-text');
        const circumference = 2 * Math.PI * 38;
        let color = ratio > 0.5 ? '#34C759' : ratio > 0.25 ? '#FF9500' : '#FF3B30';
        if (circle) {
          circle.style.strokeDasharray = `${circumference}`;
          circle.style.strokeDashoffset = `${circumference * (1 - ratio)}`;
          circle.style.stroke = color;
        }
        if (text) { text.textContent = Math.ceil(remaining); text.style.color = color; }
      }
      if (remaining <= 3 && remaining > 0 && !audioRef.current) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator(); const g = ctx.createGain();
          osc.connect(g); g.connect(ctx.destination);
          osc.frequency.value = 880; g.gain.value = 0.06;
          osc.start(); osc.stop(ctx.currentTime + 0.06);
          audioRef.current = true; setTimeout(() => { audioRef.current = null; }, 800);
        } catch {}
      }
      if (remaining <= 0 && !hasEndedRef.current) { hasEndedRef.current = true; onTimeUp(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [questionId, duration]);

  return (
    <div ref={timerRef} className="relative w-20 h-20 flex items-center justify-center">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="38" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="3" />
        <circle className="timer-ring" cx="40" cy="40" r="38" fill="none" strokeWidth="3" strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke 0.3s' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="timer-text text-[20px] font-bold">{duration}</span>
        <span className="text-[9px] font-medium text-[var(--text-tertiary)]">sec</span>
      </div>
    </div>
  );
}
