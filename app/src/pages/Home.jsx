import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Brain, Shield } from "lucide-react";
import PublicBackground from "@/components/layout/PublicBackground";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicSearchDialog from "@/components/layout/PublicSearchDialog";
import PublicFooter from "@/components/layout/PublicFooter";
import OnboardingWizard from "@/components/home/OnboardingWizard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

const FEATURES = [
  {
    icon: Brain,
    title: "Artificial Intelligence",
    description:
      "Deep-dive into machine learning, neural networks, NLP, and cutting-edge AI research with curated resources.",
  },
  {
    icon: Shield,
    title: "Cybersecurity",
    description:
      "Master network security, ethical hacking, penetration testing, and defensive strategies from real-world experts.",
  },
  {
    icon: BookOpen,
    title: "Curated Resources",
    description:
      "Access handpicked PDFs, guides, tools, and references organized by subject — all in one place.",
  },
];

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(hsla(190,100%,50%,0.3) 1px, transparent 1px),
            linear-gradient(90deg, hsla(190,100%,50%,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl sm:text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight"
        >
          Master{" "}
          <span
            style={{
              background:
                "linear-gradient(135deg, hsl(190,100%,50%), hsl(160,60%,50%))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            AI & Cybersecurity
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-muted-foreground text-lg sm:text-xl font-light max-w-2xl mx-auto mb-10"
        >
          A premium educational platform for mastering Artificial Intelligence
          and Cybersecurity — built for elite learners and professionals.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Link to="/explore">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground px-8 py-6 text-lg font-medium normal-case rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow hover:bg-primary/90 h-10 hover:brightness-110"
              style={{ boxShadow: "0 0 20px hsla(190, 100%, 50%, 0.4)" }}
            >
              Get Started →
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-4 relative z-10">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-4">
          What You'll Learn
        </h2>
        <p className="text-muted-foreground text-center mb-16 max-w-xl mx-auto">
          Everything you need to become an expert in the most in-demand fields.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className="neon-card rounded-lg p-6 bg-card cursor-default"
              style={{ borderTop: "2px solid hsl(190, 100%, 50%)" }}
            >
              <feature.icon className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();

  const needsOnboarding =
    !!profile && (!profile.major || !profile.year || !profile.semester);

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleComplete = async ({ major, year, semester }) => {
    await refreshProfile();
    navigate(`/${major}/${year}/${semester}`);
  };

  return (
    <div className="min-h-screen bg-background relative">
      <PublicBackground />
      <PublicHeader onSearchOpen={() => setSearchOpen(true)} />
      <HeroSection />
      <FeaturesSection />
      <PublicFooter />
      <PublicSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
      {needsOnboarding && <OnboardingWizard onComplete={handleComplete} />}
    </div>
  );
}
