import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

export default function Pricing() {
  const tiers = [
    {
      name: "Foundation",
      price: "$75K",
      period: "year",
      forText: "1-3 AI systems",
      perfectFor: "Community hospitals, pilot programs",
      features: [
        "Real-time monitoring across your AI",
        "Automated compliance reporting",
        "Quarterly board summaries",
        "Access to verified vendor network",
      ],
      example: "100-bed hospital governing Epic AI + 2 imaging vendors",
      buttonText: "Start with Foundation",
      highlighted: false,
    },
    {
      name: "Growth",
      price: "$200K",
      period: "year",
      forText: "4-10 AI systems",
      perfectFor: "Regional health systems",
      badge: "Most Common",
      features: [
        "Everything in Foundation",
        "Complete portfolio dashboard",
        "Monthly executive reporting",
        "Priority support",
      ],
      example: "300-bed system with Epic + 7 AI vendors",
      buttonText: "Schedule Demo",
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "$400K",
      period: "year",
      forText: "11+ AI systems",
      perfectFor: "Academic medical centers, IDNs",
      features: [
        "Everything in Growth",
        "Dedicated success manager",
        "Custom integrations",
        "99.9% SLA guarantee",
      ],
      example: "8-hospital IDN, 20+ AI vendors across network",
      buttonText: "Talk to Sales",
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-16 md:py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Pricing Built for Healthcare
          </h2>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {tiers.map((tier, index) => (
            <Card
              key={index}
              className={`p-8 flex flex-col ${
                tier.highlighted ? "border-primary shadow-lg" : ""
              }`}
              data-testid={`pricing-tier-${index}`}
            >
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-bold">{tier.name}</h3>
                  {tier.badge && (
                    <Badge variant="secondary" data-testid={`badge-${index}`}>
                      {tier.badge}
                    </Badge>
                  )}
                </div>
                <div className="mb-4">
                  <span className="text-4xl font-bold" data-testid={`price-${index}`}>{tier.price}</span>
                  <span className="text-muted-foreground">/{tier.period}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="text-muted-foreground">
                    For: <span className="font-semibold text-foreground">{tier.forText}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Perfect for: <span className="font-semibold text-foreground">{tier.perfectFor}</span>
                  </div>
                </div>
              </div>

              <div className="mb-6 space-y-3 flex-grow">
                {tier.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-start gap-3" data-testid={`tier-${index}-feature-${featureIndex}`}>
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <Button
                  className="w-full"
                  variant={tier.highlighted ? "default" : "outline"}
                  onClick={() => console.log(`${tier.buttonText} clicked`)}
                  data-testid={`button-${index}`}
                >
                  {tier.buttonText}
                </Button>
                <p className="text-xs text-muted-foreground leading-relaxed" data-testid={`example-${index}`}>
                  Example: {tier.example}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
