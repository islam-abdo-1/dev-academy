import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Brain, Rocket, Shield, UserRound } from "lucide-react";
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
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight">
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
        </h1>
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
          <Button
            asChild
            size="lg"
            className="bg-primary text-primary-foreground px-8 py-6 text-lg font-medium normal-case rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow hover:bg-primary/90 h-10 hover:brightness-110"
            style={{ boxShadow: "0 0 20px hsla(190, 100%, 50%, 0.4)" }}
          >
            <Link to="/explore">Get Started →</Link>
          </Button>
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

function AboutSection() {
  return (
    <section
      id="about"
      className="py-24 px-4 relative z-10 scroll-mt-20"
    >
      <div className="max-w-4xl mx-auto">
        <p className="text-xs font-mono text-primary mb-2 text-center">
          ABOUT DEV ACADEMY
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-4">
          About Dev Academy
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto leading-loose">
          Dev Academy is an educational platform focused on computer science,
          artificial intelligence, and cybersecurity. Its goal is to organize
          academic and technical content and make it easier for students and
          learners to access it.
        </p>

        <div className="space-y-4">
          <div
            className="p-6 rounded-xl border"
            style={{
              borderColor: "hsla(190, 100%, 50%, 0.2)",
              background: "hsla(240, 30%, 7%, 0.8)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <UserRound className="w-5 h-5 text-primary" />
              <h3 className="text-foreground font-semibold">
                <bdi dir="ltr">𝘌𝘕𝘎. 𝐼𝑠𝑙𝑎𝑚 𝐴𝑏𝑑𝑜</bdi>
              </h3>
            </div>
            <p className="text-sm text-muted-foreground leading-loose">
              Founder of Dev Academy, with a passion for computer science, web
              development, and artificial intelligence. The platform began as
              an initiative to share knowledge and make academic and technical
              content simpler for students.
            </p>
          </div>

          <div
            className="p-6 rounded-xl border"
            style={{
              borderColor: "hsla(190, 100%, 50%, 0.2)",
              background: "hsla(240, 30%, 7%, 0.8)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-primary" />
              <h3 className="text-foreground font-semibold">
                What does the platform offer?
              </h3>
            </div>
            <ul className="text-sm text-muted-foreground leading-relaxed space-y-2">
              <li>• Organized specializations and study groups for easier access to content.</li>
              <li>• Curated files, PDFs, and educational links.</li>
              <li>• Free content available to students.</li>
            </ul>
          </div>

          <div
            className="p-6 rounded-xl border"
            style={{
              borderColor: "hsla(190, 100%, 50%, 0.2)",
              background: "hsla(240, 30%, 7%, 0.8)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Rocket className="w-5 h-5 text-primary" />
              <h3 className="text-foreground font-semibold">Start here</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Browse specializations and study groups to access available
              materials and files.
            </p>
            <Button
              asChild
              className="mt-4 bg-primary text-primary-foreground px-4 py-2 text-sm font-medium rounded-md hover:bg-primary/90"
            >
              <Link to="/explore">Browse specializations</Link>
            </Button>
          </div>
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
      <AboutSection />
      <PublicFooter />
      <PublicSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
      {needsOnboarding && <OnboardingWizard onComplete={handleComplete} />}
    </div>
  );
}
