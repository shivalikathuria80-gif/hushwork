import { Fragment } from "react";
import { Btn } from "./ui";
import AgentBox from "./AgentBox";
import WorkflowBand from "./WorkflowBand";

// The headline arrives one word at a time. It is the first thing a visitor reads, so it gets the one rehearsed entrance.
// The animation is CSS (see .hw-word in globals.css), so this component needs no JavaScript of its own.
function Words({ text, className = "", delay = 0 }) {
  const words = text.split(" ");
  return (
    <span className={`block ${className}`}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span className="hw-word" style={{ "--d": `${(delay + i * 0.04).toFixed(2)}s` }}>{word}</span>
          {i < words.length - 1 && " "}
        </Fragment>
      ))}
    </span>
  );
}

const after = (seconds) => ({ "--d": `${seconds}s` });

// The hero shows the product doing its job: the real agent box sits beside the promise.
export default function Hero() {
  return (
    <section id="hero" className="relative isolate">
      {/* A soft violet light that drifts slowly behind the hero. Stops when paused or when reduced motion is on. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex h-[640px] justify-center overflow-hidden">
        <div className="hw-float mt-16 h-[360px] w-[620px] max-w-full rounded-full bg-accent/14 blur-[110px] dark:bg-accent/30" />
      </div>
      <div className="mx-auto grid max-w-6xl items-start gap-12 px-5 pb-12 pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:gap-12">
        <div className="lg:pt-8">
          <h1 className="text-[length:clamp(2.25rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
            <Words text="Describe the task." />
            <Words text="Hushwork handles it." className="text-accent-text" delay={0.12} />
          </h1>
          <p className="hw-rise mt-5 max-w-md text-lg leading-relaxed text-mute" style={after(0.2)}>
            Tell Hushwork what you do every week. It builds the workflow, connects your tools and runs it.
          </p>
          <div className="hw-rise mt-8 flex flex-wrap gap-3" style={after(0.3)}>
            <Btn href="#wait" size="lg" iconRight="ArrowRight">Join the waitlist</Btn>
            <Btn href="#how" size="lg" variant="secondary">See how it works</Btn>
          </div>
        </div>
        <div className="hw-rise" style={after(0.25)}><AgentBox /></div>
      </div>
      <WorkflowBand />
    </section>
  );
}
