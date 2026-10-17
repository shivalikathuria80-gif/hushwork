import { requireUser } from "@/lib/auth";

// Shows who is signed in. It reads the session cookie, so the layout wraps it in <Suspense>: the rest of the page
// appears straight away and the email streams in a moment later.
export default async function UserBadge() {
  const user = await requireUser();
  return <UserChip email={user.email} />;
}

// The look of the badge: a purple circle with the first letter, and the email beside it.
// It is its own export so the throwaway scratch page can draw it without signing in.
export function UserChip({ email }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-on-accent">{(email ?? "?").charAt(0).toUpperCase()}</span>
      <p className="truncate text-sm" title={email}>{email}</p>
    </div>
  );
}
