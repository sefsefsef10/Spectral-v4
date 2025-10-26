import { Card } from "@/components/ui/card";
import { Eye, Shield, FileCheck, Zap } from "lucide-react";

export default function SolutionPillars() {
  const pillars = [
    {
      icon: Eye,
      title: "SEE EVERYTHING",
      description: "Complete inventory of every AI system across your organization",
      features: [
        "What: Model names, versions, owners",
        "Where: Which departments, which workflows",
        "Risk: High/medium/low categorization",
        "Status: Real-time compliance dashboard",
      ],
      question: "What AI do we have?",
    },
    {
      icon: Shield,
      title: "MONITOR IN REAL-TIME",
      description: "24/7 safety monitoring across all vendors",
      features: [
        "PHI leakage detection (catch it before breach)",
        "Model drift alerts (know when performance degrades)",
        "Bias monitoring (demographic equity checks)",
        "Automated rollback (stop failures instantly)",
      ],
      question: "Is our AI safe right now?",
    },
    {
      icon: FileCheck,
      title: "PROVE COMPLIANCE",
      description: "Automated audit evidence for regulators",
      features: [
        "Daily HIPAA compliance reports",
        "NIST AI RMF mapping",
        "FDA readiness documentation",
        "State law compliance (CA, CO, NYC)",
      ],
      question: "Can we prove we're compliant?",
    },
    {
      icon: Zap,
      title: "FAST-TRACK VENDORS",
      description: "Accept pre-verified vendors in weeks, not months",
      features: [
        "Independent third-party certification",
        "Skip redundant security reviews",
        '"Spectral Verified" = pre-approved',
        "Growing network of certified vendors",
      ],
      question: "How do we speed up procurement?",
    },
  ];

  return (
    <section className="py-16 md:py-20 lg:py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            What Spectral Does
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            One platform to govern all your AI—regardless of vendor.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {pillars.map((pillar, index) => (
            <Card
              key={index}
              className="p-6 md:p-8 hover-elevate transition-shadow"
              data-testid={`pillar-${index}`}
            >
              <div className="mb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <pillar.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-2">{pillar.title}</h3>
                <p className="text-sm text-muted-foreground">{pillar.description}</p>
              </div>

              <ul className="space-y-3 mb-6">
                {pillar.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-2" data-testid={`pillar-${index}-feature-${featureIndex}`}>
                    <span className="text-primary mt-1">•</span>
                    <span className="text-sm leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-4 border-t">
                <p className="text-sm font-semibold">
                  Finally answer: "{pillar.question}"
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
