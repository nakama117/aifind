// 站点的字标和圆环标记：页面用 Wordmark 画站名（size 是高度，单位像素），RingMark 是小标记，转起来就是加载动画。
// 这里用站名排字；有自己的 Logo 时，把 Wordmark 换成你的 SVG（保持同样的参数）。
import { SITE } from "../site.ts";

export function Wordmark({ size = 24, className = "", title = SITE.name }: { size?: number; className?: string; title?: string }) {
  return (
    <span className={`inline-flex items-center font-black leading-none tracking-[-0.03em] ${className}`} style={{ fontSize: Math.round(size * 0.92) }} aria-label={title} role="img">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-[0.3em] size-[1em] text-accent" fill="currentColor"><rect x="2" y="14" width="4" height="8" rx="2" /><rect x="10" y="8" width="4" height="14" rx="2" /><rect x="18" y="2" width="4" height="20" rx="2" /></svg>
      <span aria-hidden="true">{SITE.name}</span>
    </span>
  );
}

/** A ring with a dot; spinning, it is the loader. */
export function RingMark({ className = "", spinning = false }: { className?: string; spinning?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g style={spinning ? { transformOrigin: "12px 12px", animation: "spin-slow 1.1s linear infinite" } : undefined}>
        <rect x="2" y="14" width="4" height="8" rx="2" fill="currentColor" />
        <rect x="10" y="8" width="4" height="14" rx="2" fill="currentColor" />
        <rect x="18" y="2" width="4" height="20" rx="2" fill="currentColor" />
      </g>
    </svg>
  );
}
