import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

// The frame of the public agent pages (/agents, /agents/<id>, /agents/try): the landing page's bar and footer around the content.
// Nothing here reads a sign-in, so the pages are built ahead of time and search engines can read them.
export default function PublicFrame({ children }) {
  return (
    <div id="top">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-xl focus:bg-ink focus:px-4 focus:py-3 focus:text-bg">
        Skip to content
      </a>
      <Nav base="/" />
      <main id="main" className="mx-auto w-full max-w-5xl px-5 pb-24 pt-28 sm:px-8">{children}</main>
      <Footer />
    </div>
  );
}
