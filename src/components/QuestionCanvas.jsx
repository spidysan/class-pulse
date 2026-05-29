import React, { useEffect, useRef } from 'react';

export default function QuestionCanvas({ questionText }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = 600, h = 260, dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Light background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = 'rgba(0,0,0,0.02)';
    ctx.lineWidth = 1;
    for (let x = 30; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 30; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // Question text
    ctx.fillStyle = '#1D1D1F';
    ctx.font = '500 19px -apple-system, Inter, sans-serif';
    ctx.textBaseline = 'top';
    wrapText(ctx, questionText || "Loading question...", 36, 36, w - 72, 28);

    // OCR disruption curves
    ctx.strokeStyle = 'rgba(0,122,255,0.03)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * w, 0);
      ctx.bezierCurveTo(Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h, Math.random() * w, h);
      ctx.stroke();
    }

    // Noise
    const imgData = ctx.getImageData(0, 0, w * dpr, h * dpr);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const g = (Math.random() - 0.5) * 14;
      data[i] = Math.min(255, Math.max(0, data[i] + g));
      data[i+1] = Math.min(255, Math.max(0, data[i+1] + g));
      data[i+2] = Math.min(255, Math.max(0, data[i+2] + g));
    }
    ctx.putImageData(imgData, 0, 0);
  }, [questionText]);

  const wrapText = (ctx, text, x, y, maxW, lh) => {
    const words = text.split(' ');
    let line = '', cy = y;
    for (let n = 0; n < words.length; n++) {
      const test = line + words[n] + ' ';
      if (ctx.measureText(test).width > maxW && n > 0) { ctx.fillText(line, x, cy); line = words[n] + ' '; cy += lh; }
      else line = test;
    }
    ctx.fillText(line, x, cy);
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-card)' }}>
      <canvas ref={canvasRef} className="block max-w-full h-auto mx-auto pointer-events-none select-none" />
    </div>
  );
}
