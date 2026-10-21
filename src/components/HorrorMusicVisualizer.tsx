import React, { useEffect, useRef } from 'react';
import { useHorrorMusic } from '../context/HorrorMusicContext.js';

interface HorrorMusicVisualizerProps {
  className?: string;
  barCount?: number;
}

export function HorrorMusicVisualizer({ className = '', barCount = 16 }: HorrorMusicVisualizerProps) {
  const { getAnalyser, isPlaying, isMuted } = useHorrorMusic();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const analyser = getAnalyser();

      if (!isPlaying || isMuted || !analyser) {
        // Render idle resting horror heartbeat baseline
        const barWidth = Math.max(2, (width - (barCount - 1) * 2) / barCount);
        for (let i = 0; i < barCount; i++) {
          const x = i * (barWidth + 2);
          ctx.fillStyle = 'rgba(6, 182, 212, 0.2)'; // Faint cyan idle
          ctx.fillRect(x, height - 3, barWidth, 3);
        }
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      const barWidth = Math.max(2, (width - (barCount - 1) * 2) / barCount);

      for (let i = 0; i < barCount; i++) {
        // Sample frequencies logarithmically skewed towards bass / lower mids
        const index = Math.floor(Math.pow(i / barCount, 1.4) * (bufferLength / 2));
        const val = dataArray[index] || 0;
        const normalized = val / 255;
        const barHeight = Math.max(3, normalized * height);
        const x = i * (barWidth + 2);
        const y = height - barHeight;

        // Gradient from deep indigo to luminous neon cyan
        const gradient = ctx.createLinearGradient(0, height, 0, y);
        gradient.addColorStop(0, 'rgba(79, 70, 229, 0.85)'); // indigo
        gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.95)'); // cyan
        gradient.addColorStop(1, 'rgba(165, 243, 252, 1)'); // bright cyan peak

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, isMuted, getAnalyser, barCount]);

  return (
    <canvas
      ref={canvasRef}
      width={barCount * 4 + 10}
      height={22}
      className={`rounded pointer-events-none ${className}`}
      title={isPlaying ? 'Mystery Theme Sound Wave' : 'Mystery Music Inactive'}
    />
  );
}
