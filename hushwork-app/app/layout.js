import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MotionProvider from "@/components/MotionProvider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const title = "Hushwork: describe the task, we run it quietly";

// metadataBase turns relative image links into full web addresses for link previews.
// Set NEXT_PUBLIC_SITE_URL once the site has its own domain. Vercel fills in its own address meanwhile.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3100");

export const metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description:
    "Hushwork turns a plain-English description of your weekly admin into a workflow you can read, approve and let run. Join the early access list.",
  openGraph: {
    type: "website",
    siteName: "Hushwork",
    title,
    description: "Describe a weekly task in plain English. Hushwork builds the workflow, asks before it sends anything, and keeps a log of every run.",
  },
  twitter: { card: "summary_large_image", title, description: "Describe a weekly task in plain English. Hushwork builds the workflow and runs it for you." },
};

export const viewport = { themeColor: "#121018", colorScheme: "dark light" };

// Runs before the page paints so the saved theme shows immediately (no light flash). Dark is the default.
const themeScript = `try{var t=localStorage.getItem('hw-theme');if(t!=='light')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Without JavaScript the fade-in animations never run, so show everything straight away. */}
        <noscript>
          <style>{`[style*="opacity:0"],[style*="clip-path"]{opacity:1!important;transform:none!important;filter:none!important;clip-path:none!important}`}</style>
        </noscript>
      </head>
      <body className="min-h-dvh bg-bg font-sans text-ink">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
