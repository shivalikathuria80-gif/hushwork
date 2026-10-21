import { Icon } from "./icons";
import { fallbackIcon, logoFor } from "@/lib/app-logos";

// A round-cornered white tile with the app's logo in its brand colour (lib/app-logos.js). The tile stays white in dark mode too, so the
// brand colours always stay readable. An app with no logo gets a plain icon in the site's accent colour.
// `size` is the tile's width and height in pixels.
export default function AppLogo({ id, label, size = 44, className = "" }) {
  const logo = logoFor(id);
  const tile = `grid shrink-0 place-items-center rounded-xl border border-line ${className}`;
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
