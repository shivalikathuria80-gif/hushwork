"use client";

import { Icon } from "../icons";
import { useTheme } from "../useTheme";

// Light/dark switch used on the sign-in page and inside the app. (The landing page's Nav keeps its own.)
// The icon and the words are swapped by CSS ("dark:" classes), so the server and browser HTML always match.
// Pass withLabel for a button with words ("Light mode" / "Dark mode"), otherwise it is a round icon button.
export default function ThemeToggle({ withLabel = false, className = "" }) {
  const [dark, toggle] = useTheme();
  const label = dark === null ? "Toggle theme" : dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button" onClick={toggle} aria-label={withLabel ? undefined : label}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm text-mute transition-colors hover:bg-raised hover:text-ink md:h-9 ${withLabel ? "px-3" : "w-11 md:w-9"} ${className}`}
    >
      <span className="hidden dark:block"><Icon name="Sun" size={18} /></span>
      <span className="dark:hidden"><Icon name="Moon" size={18} /></span>
      {withLabel && (
        <>
          <span className="hidden dark:inline">Light mode</span>
          <span className="dark:hidden">Dark mode</span>
        </>
      )}
    </button>
  );
}
