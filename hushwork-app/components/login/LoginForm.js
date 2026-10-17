"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Btn } from "../ui";
import { Icon } from "../icons";
import { signIn, signUp } from "@/lib/actions/auth";
import { LIMITS } from "@/lib/validate";

const COPY = {
  signin: { title: "Welcome back", sub: "Sign in to see your drafts.", button: "Sign in", working: "Signing in..." },
  create: { title: "Create your account", sub: "Save your plans as drafts and come back to them.", button: "Create account", working: "Creating your account..." },
};
const OFFLINE = "Cannot reach Hushwork. Check your internet connection and try again.";
const inputClass = "h-12 w-full rounded-xl border bg-surface px-4 text-[15px] text-ink placeholder:text-hint focus-visible:border-accent";

// The sign-in / create-account form. How it works:
// 1. The person fills in the fields and presses the button.
// 2. React sends the form to a Server Action (lib/actions/auth.js), which checks it and talks to Supabase.
// 3. On success the server redirects to /app. On a problem it returns a small { kind, error, field } object,
//    and this component shows that sentence next to the right field.
export default function LoginForm() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [dismissed, setDismissed] = useState(null); // a result the person has moved on from (switched mode)
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const submitRef = useRef(null);
  const existsRef = useRef(null);

  const [result, formAction, pending] = useActionState(async (_previous, formData) => {
    const action = formData.get("mode") === "create" ? signUp : signIn;
    try {
      return await action(formData);
    } catch (problem) {
      // A successful sign-in redirects, and Next.js delivers that redirect as an error. Let it through.
      unstable_rethrow(problem);
      return { kind: "network", error: OFFLINE };
    }
  }, null);

  const shown = result && result !== dismissed ? result : null;
  const confirming = shown?.kind === "confirm";
  const emailError = shown?.field === "email" ? shown.error : null;
  const passwordError = shown?.field === "password" ? shown.error : null;
  const formError = shown?.error && !shown.field ? shown : null;
  const creating = mode === "create";

  // After a failed attempt, move the cursor to the place that needs attention.
  useEffect(() => {
    if (!shown?.error) return;
    let target = submitRef;
    if (shown.field === "email") target = emailRef;
    else if (shown.field === "password" || shown.kind === "credentials") target = passwordRef;
    else if (shown.kind === "exists") target = existsRef;
    target.current?.focus();
  }, [shown]);

  function switchTo(next, focusPassword = false) {
    setMode(next);
    setDismissed(result); // hides the old message
    setShowPassword(false);
    if (focusPassword) passwordRef.current?.focus();
  }

  const copy = COPY[mode];

  return (
    <div className="w-full">
      <div key={confirming ? "confirm" : mode} className="animate-[hw-fade_120ms_var(--ease)_both]">
        <h1 className="text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em]">{confirming ? "Check your email" : copy.title}</h1>
        {!confirming && <p className="mt-2 text-[15px] text-mute">{copy.sub}</p>}
      </div>

      {confirming ? (
        <div role="status" className="mt-6">
          <p className="text-[15px] leading-relaxed">
            We sent a link to <b className="break-all font-medium">{shown.email}</b>. Open it to confirm your address, then come back here and sign in.
            The link does not sign you in by itself.
          </p>
          <Btn variant="ghost" className="mt-4" onClick={() => setDismissed(result)}>Use a different email</Btn>
        </div>
      ) : (
        <>
          <fieldset className="mt-6">
            <legend className="sr-only">Choose how to continue</legend>
            <div className="grid grid-cols-2 rounded-xl border border-field bg-surface p-1">
              {[["signin", "Sign in"], ["create", "Create account"]].map(([value, label]) => (
                <label key={value} className="relative block">
                  <input type="radio" name="how" value={value} checked={mode === value} onChange={() => switchTo(value)} className="peer sr-only" />
                  <span className="flex h-11 cursor-pointer items-center justify-center rounded-md text-[15px] font-medium text-mute transition-colors duration-120 ease-standard hover:bg-raised peer-checked:bg-accent peer-checked:text-on-accent peer-checked:hover:bg-accent-hover peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-focus-visible:shadow-[var(--ring)] md:h-10">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <form action={formAction} onSubmit={() => setShowPassword(false)} noValidate className="mt-6 space-y-4">
            <input type="hidden" name="mode" value={mode} />

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">Email address</label>
              <input
                id="email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
                ref={emailRef} value={email} onChange={(event) => setEmail(event.target.value)} maxLength={LIMITS.emailMax}
                placeholder="you@company.com"
                aria-invalid={emailError ? true : undefined} aria-describedby={emailError ? "email-error" : undefined}
                className={`${inputClass} ${emailError ? "border-error" : "border-field"}`}
              />
              {emailError && <p id="email-error" className="mt-2 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{emailError}</p>}
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label>
              <div className="relative">
                <input
                  id="password" name="password" type={showPassword ? "text" : "password"}
                  autoComplete={creating ? "new-password" : "current-password"} autoCapitalize="none" spellCheck={false}
                  ref={passwordRef}
                  aria-invalid={passwordError ? true : undefined} aria-describedby={creating || passwordError ? "password-note" : undefined}
                  className={`${inputClass} pr-14 ${passwordError ? "border-error" : "border-field"}`}
                />
                <button
                  type="button" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword} aria-label="Show password"
                  className="absolute right-0 top-0 grid h-12 w-12 place-items-center rounded-xl text-mute transition-colors duration-120 ease-standard hover:text-ink"
                >
                  <Icon name={showPassword ? "EyeOff" : "Eye"} size={20} />
                </button>
              </div>
              {passwordError ? (
                <p id="password-note" className="mt-2 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{passwordError}</p>
              ) : creating ? (
                <p id="password-note" className="mt-2 text-sm text-mute">At least {LIMITS.passwordMin} characters.</p>
              ) : null}
            </div>

            {formError && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-error bg-raised px-3 py-3 text-sm">
                <Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />
                <div>
                  <p>{formError.error}</p>
                  {formError.kind === "credentials" && (
                    <button type="button" onClick={() => switchTo("create", true)} className="mt-1 inline-flex min-h-8 items-center text-accent-text underline underline-offset-4">New here? Create an account</button>
                  )}
                  {formError.kind === "exists" && (
                    <button type="button" ref={existsRef} onClick={() => switchTo("signin", true)} className="mt-1 inline-flex min-h-8 items-center text-accent-text underline underline-offset-4">Sign in instead</button>
                  )}
                </div>
              </div>
            )}

            <Btn type="submit" size="lg" ref={submitRef} loading={pending} className="w-full">{copy.button}</Btn>
            <p role="status" className="sr-only">{pending ? copy.working : ""}</p>
          </form>

          <p className="mt-4 text-sm leading-relaxed text-mute">
            {creating ? "Hushwork is an early preview. You can describe work and save drafts. Nothing runs yet. " : ""}
            We store your email and your drafts. <Link href="/privacy">Privacy</Link>
          </p>
        </>
      )}
    </div>
  );
}
