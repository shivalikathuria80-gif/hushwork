import { Reveal } from "./ui";
import { Icon } from "./icons";
import ChatbotPlugin from "./ChatbotPlugin";
import { TiltIn } from "./ScrollFx";

const POINTS = [
  ["Bot", "Make an agent by asking", "“Every Monday, sum up my calendar” becomes a scheduled Hushwork agent."],
  ["History", "Ask what happened", "Claude reads your runs and the Hushwork Agent's notes and tells you in plain words."],
  ["ShieldCheck", "You still approve", "Anything that sends or creates waits until you say yes in the chat."],
];

// The landing page band for the chatbot plugin (the same box the app's home page shows, with a sign-up button instead of Settings).
export default function ChatbotSection() {
  return (
    <section id="plugin" className="py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center">
        <Reveal>
          <p className="text-sm font-semibold text-accent-text">New: chatbot plugin</p>
          <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight md:text-5xl">Run Hushwork from Claude</h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-mute">Connect once and talk to your agents from the chat you already use.</p>
          <ul className="mt-6 space-y-4">
            {POINTS.map(([icon, title, body]) => (
              <li key={title} className="flex gap-3">
                <Icon name={icon} size={20} className="mt-0.5 shrink-0 text-accent-text" />
                <div><p className="font-medium">{title}</p><p className="text-sm text-mute">{body}</p></div>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.08}><TiltIn><ChatbotPlugin place="landing" /></TiltIn></Reveal>
      </div>
    </section>
  );
}
