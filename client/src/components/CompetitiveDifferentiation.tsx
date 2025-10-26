import { Card } from "@/components/ui/card";
import { Check, X } from "lucide-react";

export default function CompetitiveDifferentiation() {
  const alternatives = [
    {
      name: "Build It Yourself (DIY)",
      cost: "$15M + 5 years",
      approach: "Hire team, build infrastructure, maintain forever",
      problems: [
        "Need healthcare + AI + compliance expertise",
        "Regulations change quarterly (HIPAA, NIST, FDA)",
        "No vendor adoption (they won't integrate with just you)",
        "Opportunity cost: Focus on patients, not software",
      ],
      verdict: "Most hospitals try this. All fail within 18 months.",
    },
    {
      name: "Qualified Health",
      cost: "Closed platform",
      approach: "AI productivity tool for internal chat/search",
      problems: [
        "Solves internal AI usage, not portfolio governance",
        "No vendor certification workflow",
        "No independent third-party verification",
        "Complementary, not competitive (use both)",
      ],
      verdict: "Different problem. Spectral governs your entire AI portfolio.",
    },
    {
      name: "LangSmith / Arize AI",
      cost: "Horizontal monitoring",
      approach: "Generic AI observability tools",
      problems: [
        "Monitor AI performance (latency, accuracy)",
        "Don't translate to healthcare compliance (HIPAA, NIST)",
        "You still need to interpret telemetry",
        "Spectral integrates them as data sources",
      ],
      verdict: "They're the input. We're the compliance translation layer.",
    },
  ];

  return (
    <section className="py-16 md:py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Why Spectral? Why Not Build or Buy Alternatives?
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            We're not competing with tools. <span className="font-semibold text-foreground">We're the infrastructure layer they build on.</span>
          </p>
        </div>

        <div className="space-y-8 mb-12">
          {alternatives.map((alt, index) => (
            <Card key={index} className="p-6 md:p-8" data-testid={`alternative-${index}`}>
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-shrink-0 md:w-64">
                  <h3 className="text-xl font-bold mb-2">{alt.name}</h3>
                  <div className="text-sm text-muted-foreground mb-1">Cost: <span className="font-semibold text-destructive">{alt.cost}</span></div>
                  <div className="text-sm text-muted-foreground">Approach: {alt.approach}</div>
                </div>

                <div className="flex-grow">
                  <p className="font-semibold mb-3 text-sm">Why this doesn't work:</p>
                  <ul className="space-y-2 mb-4">
                    {alt.problems.map((problem, pIndex) => (
                      <li key={pIndex} className="flex items-start gap-2 text-sm">
                        <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                        <span>{problem}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm font-semibold bg-muted/50 p-3 rounded">
                    Verdict: {alt.verdict}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-8 md:p-12 bg-primary/5">
          <h3 className="text-2xl md:text-3xl font-bold mb-6 text-center">
            Spectral Is Different: Independent Verification Standard
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Check className="w-5 h-5 text-primary" />
                Like SOC 2 Auditors for Healthcare AI
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Third-party independent verification</li>
                <li>• Health systems trust the standard, not individual vendors</li>
                <li>• Network effects: More adoption = stronger standard</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Check className="w-5 h-5 text-primary" />
                Translation Engine (Core IP)
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Converts AI telemetry → HIPAA/NIST compliance violations</li>
                <li>• 3-year head start in healthcare compliance mapping</li>
                <li>• Would take competitors $15M and 5 years to replicate</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
