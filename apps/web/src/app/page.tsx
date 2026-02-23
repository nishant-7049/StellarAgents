import { Navbar }           from "@/components/landing/Navbar";
import { Hero }             from "@/components/landing/Hero";
import { HowItWorks }       from "@/components/landing/HowItWorks";
import { Features }         from "@/components/landing/Features";
import { DeveloperSection } from "@/components/landing/DeveloperSection";
import { Footer }           from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <HowItWorks />
      <Features />
      <DeveloperSection />
      <Footer />
    </main>
  );
}
