"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, unstable_rethrow } from "next/navigation";
import { Btn, Logo } from "../ui";
import { Icon } from "../icons";
import ThemeToggle from "./ThemeToggle";
import { signOut } from "@/lib/actions/auth";

// The app's frame. At 1024px and wider it is a sticky sidebar. Below that it is a 56px top bar whose menu button
// opens a dropdown with the same links. It is one block of HTML, restyled by CSS, so the links exist only once.
// `userBadge` is a server-rendered piece (the signed-in email) handed in by app/app/layout.js.

function NavLink({ href, icon, children, onNavigate }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href} onClick={onNavigate} aria-current={active ? "page" : undefined}
      className={`relative flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors ${active ? "bg-raised font-medium text-ink before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-accent-text" : "text-mute hover:bg-raised hover:text-ink"}`}
    >
      <Icon name={icon} size={18} />{children}
    </Link>
  );
}

function SignOutButton() {
  const [message, action, pending] = useActionState(async () => {
    try {
      await signOut();
    } catch (problem) {
      unstable_rethrow(problem); // signing out ends in a redirect, which Next.js delivers as an error
      return "Could not sign out. Try again.";
    }
    return null;
  }, null);
  return (
    <form action={action}>
      <Btn type="submit" variant="ghost" icon="SignOut" loading={pending} className="w-full justify-start!">Sign out</Btn>
      <p role="status" className="px-3 text-sm text-mute">{message}</p>
    </form>
  );
}

export default function AppNav({ userBadge }) {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const close = () => setOpen(false);
  // Escape closes the phone menu and puts the keyboard cursor back on the menu button, so it is not lost.
  const closeWithEscape = () => { if (open) { setOpen(false); menuButtonRef.current?.focus(); } };
  // "New workflow" is the same page as the workspace, so the link alone would do nothing there.
  // This tells the composer (if it is on screen) to clear itself and take focus.
  const newWorkflow = () => { close(); window.dispatchEvent(new Event("hw:new-workflow")); };

  return (
    <header
      onKeyDown={(event) => { if (event.key === "Escape") closeWithEscape(); }}
      className="relative z-30 border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r"
    >
      <div className="flex h-14 items-center justify-between px-5 sm:px-8 lg:h-auto lg:px-4 lg:pt-3">
        <Logo href="/app" />
        <button
          type="button" ref={menuButtonRef} onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="app-menu" aria-label={open ? "Close menu" : "Open menu"}
          className="grid h-11 w-11 place-items-center rounded-xl text-mute hover:bg-raised hover:text-ink lg:hidden"
        >
          <Icon name={open ? "X" : "Menu"} size={18} />
        </button>
      </div>

      <div id="app-menu" className={`${open ? "hw-fade flex" : "hidden"} absolute inset-x-0 top-full flex-col gap-6 border-b border-line bg-surface p-3 sm:px-6 lg:static lg:flex lg:flex-1 lg:justify-between lg:border-0 lg:p-4`}>
        <nav aria-label="Workspace" className="flex flex-col gap-1">
          <Btn href="/app" icon="Plus" onClick={newWorkflow} className="mb-2 w-full">New workflow</Btn>
          <NavLink href="/app/runs" icon="History" onNavigate={close}>Runs</NavLink>
        </nav>
        <div className="flex flex-col gap-1">
          <div className="min-w-0 px-3 pb-2">
            <p className="text-xs text-mute">Signed in as</p>
            {userBadge}
          </div>
          <ThemeToggle withLabel className="w-full justify-start!" />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
