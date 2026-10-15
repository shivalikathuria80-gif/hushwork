import { requireUser } from "@/lib/auth";

// Shows who is signed in. It reads the session cookie, so the layout wraps it in <Suspense>: the rest of the page
// appears straight away and the email streams in a moment later.
export default async function UserBadge() {
  const user = await requireUser();
  return <p className="truncate text-sm" title={user.email}>{user.email}</p>;
}
