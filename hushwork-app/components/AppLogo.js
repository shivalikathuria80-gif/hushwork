import { Icon } from "./icons";
import { artFor, fallbackIcon, logoFor } from "@/lib/app-logos";

// A round-cornered white tile with the app's logo (lib/app-logos.js): the full-colour drawn logo if there is one (Gmail, Drive, Calendar,
// Sheets, Slack), otherwise the one-colour logo in its brand colour. The tile stays white in dark mode too, so the colours always stay
// readable. An app with no logo gets a plain icon in the site's accent colour. `size` is the tile's width and height in pixels.
function Shape({ shape }) {
  if (shape.text) return <text x={shape.x} y={shape.y} textAnchor="middle" fontSize={shape.size} fontWeight="700" fontFamily="Arial, Helvetica, sans-serif" fill={shape.fill}>{shape.text}</text>;
  if (shape.rect) {
    const [x, y, width, height, rx] = shape.rect;
    return <rect x={x} y={y} width={width} height={height} rx={rx} fill={shape.fill ?? "none"} stroke={shape.stroke} strokeWidth={shape.stroke ? 0.6 : undefined} />;
  }
  return <path d={shape.d} fill={shape.fill ?? "none"} stroke={shape.stroke} strokeWidth={shape.stroke ? 0.9 : undefined} strokeLinecap="round" />;
}

export default function AppLogo({ id, label, size = 44, className = "" }) {
  const art = artFor(id);
  const logo = art ? null : logoFor(id);
  const tile = `grid shrink-0 place-items-center rounded-xl border border-line ${className}`;
  if (art) {
    return (
      <span role="img" aria-label={`${label ?? art.title} logo`} className={`${tile} bg-white`} style={{ width: size, height: size }}>
        <svg viewBox={art.viewBox} width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} aria-hidden="true">
          {art.shapes.map((shape, index) => <Shape key={index} shape={shape} />)}
        </svg>
      </span>
    );
  }
  if (!logo) {
    return (
      <span aria-hidden="true" className={`${tile} bg-accent-subtle text-accent-text`} style={{ width: size, height: size }}>
        <Icon name={fallbackIcon(id)} size={Math.round(size * 0.5)} />
      </span>
    );
  }
  return (
    <span role="img" aria-label={`${label ?? logo.title} logo`} className={`${tile} bg-white`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={Math.round(size * 0.55)} height={Math.round(size * 0.55)} fill={`#${logo.hex}`} aria-hidden="true"><path d={logo.path} /></svg>
    </span>
  );
}

// Several logos in a row (Google is four products behind one connection).
export function AppLogos({ ids, size = 36 }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {ids.map((id) => <AppLogo key={id} id={id} size={size} />)}
    </span>
  );
}
