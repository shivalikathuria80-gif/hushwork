// The hero shows the product doing its job: the real agent box sits beside the promise.
function Hero() {
  const rise = d => ({ animation: 'hwRise .8s cubic-bezier(.16,1,.3,1) ' + d + 's both' });
  return <section id="hero" className="mx-auto grid max-w-6xl items-start gap-12 px-5 pb-20 pt-24lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:gap-12">
    <div className="lg:pt-8">
      <h1 className="text-[clamp(2.25rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.03em]" style={rise(0)}><span className="block">Describe the task.</span><span className="block text-accent-text">Hushwork handles it.</span></h1>
      <p className="mt-5 max-w-md text-lg leading-relaxed text-mute" style={rise(.12)}>Tell Hushwork what you do every week. It builds the workflow, connects your tools and runs it.</p>
      <div className="mt-8 flex flex-wrap gap-3" style={rise(.24)}><Btn href="#wait" size="lg" iconRight="ArrowRight">Join the waitlist</Btn><Btn href="#how" size="lg" variant="secondary">See how it works</Btn></div>
    </div>
    <div style={rise(.18)}><AgentBox /></div>
  </section>;
}
Object.assign(window, { Hero });
