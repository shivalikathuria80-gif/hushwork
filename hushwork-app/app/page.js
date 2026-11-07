import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Automations from "@/components/Automations";
import Features from "@/components/Features";
import ChatbotSection from "@/components/ChatbotSection";
import SignUpCta from "@/components/SignUpCta";
import Footer from "@/components/Footer";
import { ScrollProgress, TextReveal } from "@/components/ScrollFx";

export default function Home() {
  return (
    <div id="top">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-xl focus:bg-ink focus:px-4 focus:py-3 focus:text-bg">
        Skip to content
      </a>
      <ScrollProgress />
      <Nav />
      <main id="main">
        <Hero />
        <section aria-label="What Hushwork does">
          <TextReveal text="Most of your week is small chores. Chasing invoices, summing up calendars, nudging leads. *Hushwork does them quietly, asks before anything leaves, and shows you every step." />
        </section>
        <HowItWorks />
        <ChatbotSection />
        <Automations />
        <Features />
        <SignUpCta />
      </main>
      <Footer />
    </div>
  );
}
