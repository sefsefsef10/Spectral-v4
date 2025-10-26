import { Card } from "@/components/ui/card";
import { Check, FileText, Award, BarChart3 } from "lucide-react";

export default function VendorSolution() {
  const benefits = [
    "Independent third-party validation",
    "Healthcare AI-specific testing (PHI, bias, drift, security)",
    "Mapped to HIPAA, NIST, FDA standards",
    "Accepted by growing network of health systems",
  ];

  const steps = [
    "Submit your AI for verification (1 day)",
    "We test it (2-6 weeks depending on tier)",
    "Get your Spectral Verified badge",
    "Share your Trust Page in every deal",
    "Health systems fast-track you",
  ];

  const includes = [
    {
      icon: FileText,
      title: "Trust Page",
      description: "Public URL showing your verification status",
      details: ["Mapped to HIPAA/NIST/FDA/ISO standards", "Share in every pitch and RFP"],
    },
    {
      icon: Award,
      title: "Spectral Verified Badge",
      description: "Display on your website and pitch decks",
      details: ["Procurement teams recognize it", "Signals: independently validated, healthcare-ready"],
    },
    {
      icon: BarChart3,
      title: "Gap Report (if needed)",
      description: "Shows exactly what to fix before going public",
      details: [
        "Prioritized: Critical → Important → Nice-to-have",
        "Most vendors iterate 1-2 times before certification",
      ],
    },
  ];

  return (
    <section className="py-16 md:py-20 lg:py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            What Spectral Does
          </h2>
          <p className="text-xl md:text-2xl font-semibold max-w-3xl mx-auto">
            Get verified once. Close deals everywhere.
          </p>
        </div>

        <Card className="p-8 md:p-12 max-w-4xl mx-auto mb-12">
          <h3 className="text-2xl font-bold mb-6">Get "Spectral Verified" certification:</h3>
          <div className="space-y-4">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3" data-testid={`benefit-${index}`}>
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{benefit}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-8 border-t">
            <p className="text-xl font-semibold text-center">
              Show the badge. Skip the 6-month review.
            </p>
          </div>
        </Card>

        <div className="mb-16">
          <h3 className="text-2xl md:text-3xl font-bold text-center mb-8">How It Works</h3>
          <div className="max-w-3xl mx-auto space-y-4">
            {steps.map((step, index) => (
              <Card key={index} className="p-6 flex items-start gap-4" data-testid={`step-${index}`}>
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                  {index + 1}
                </div>
                <p className="leading-relaxed pt-1">{step}</p>
              </Card>
            ))}
          </div>
          <div className="text-center mt-8">
            <p className="text-xl font-semibold">
              Procurement time: <span className="text-destructive line-through">6-12 months</span>{" "}
              <span className="text-primary">→ 2-3 weeks</span>
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-2xl md:text-3xl font-bold text-center mb-8">What You Get</h3>
          <p className="text-center text-lg text-muted-foreground mb-12">
            Every verification includes:
          </p>
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {includes.map((item, index) => (
              <Card key={index} className="p-6 md:p-8" data-testid={`include-${index}`}>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h4 className="text-xl font-bold mb-2">{item.title}</h4>
                <p className="text-sm text-muted-foreground mb-4">{item.description}</p>
                <ul className="space-y-2">
                  {item.details.map((detail, detailIndex) => (
                    <li key={detailIndex} className="flex items-start gap-2" data-testid={`include-${index}-detail-${detailIndex}`}>
                      <span className="text-primary mt-1">•</span>
                      <span className="text-sm leading-relaxed">{detail}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
