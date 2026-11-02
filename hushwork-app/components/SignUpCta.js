import { Btn, Reveal } from "@/components/ui";

// The last band of the home page: Hushwork is open, so it asks people to make an account (it used to be the waitlist form).
// The id stays "wait" so older links to hushwork.in/#wait still land here.
export default function SignUpCta() {
  return (
    <section id="wait" className="px-5 pb-12 md:px-12">
      <Reveal>
        <div className="on-accent mx-auto max-w-6xl rounded-3xl bg-accent px-6 py-16 text-center text-on-accent md:py-20">
          <h2 className="text-[length:clamp(2rem,5vw,2.75rem)] font-semibold tracking-tight">Get your week back.</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-on-accent/90">Make a free account, describe one chore and watch the plan appear. Nothing is sent until you press Approve.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Btn href="/login#create" variant="dark" size="lg" iconRight="ArrowRight">Sign up free</Btn>
            <Btn href="/login" variant="secondary" size="lg">Log in</Btn>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
