import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Automations from "@/components/Automations";
import Features from "@/components/Features";
import Waitlist from "@/components/Waitlist";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div id="top">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-xl focus:bg-ink focus:px-4 focus:py-3 focus:text-bg">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <HowItWorks />
        <Automations />
        <Features />
        <Waitlist />
      </main>
      <Footer />
    </div>
  );
}
