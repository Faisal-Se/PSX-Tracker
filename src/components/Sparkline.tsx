"use client";

import { useId } from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Color override; defaults to profit/loss based on trend */
  color?: string;
  strokeWidth?: number;
  fill?: boolean;
}

/**
 * Lightweight dependency-free SVG sparkline.
 * Auto-colors green/red by overall trend unless `color` is given.
 */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  className,
  color,
  strokeWidth = 1.5,
  fill = false,
}: SparklineProps) {
  const id = useId();
  const clean = data.filter((n) => Number.isFinite(n));
  if (clean.length < 2) {
    return <svg width={width} height={height} className={className} />;
  }

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const stepX = width / (clean.length - 1);
  const pad = strokeWidth;
  const h = height - pad * 2;

  const points = clean.map((v, i) => {
    const x = i * stepX;
    const y = pad + h - ((v - min) / range) * h;
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");

  const trendUp = clean[clean.length - 1] >= clean[0];
  const stroke =
    color ?? (trendUp ? "var(--color-profit)" : "var(--color-loss)");

  const area =
    fill && points.length
      ? `${line} L${width},${height} L0,${height} Z`
      : "";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#spark-${id})`} stroke="none" />
        </>
      )}
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
