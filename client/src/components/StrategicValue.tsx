import { Card } from "@/components/ui/card";
import { Shield, Network, Clock, Database } from "lucide-react";

export default function StrategicValue() {
  const valueDrivers = [
    {
      icon: Shield,
      title: "Control Value",
      tagline: "Whoever Owns Verification Sets the Standards",
      points: [
        "Control which AI vendors get hospital access",
        "Shape the future of healthcare AI governance",
        "Become the required checkpoint for market entry",
        "Epic, Microsoft, Philips: Integrate or get disintermediated",
      ],
    },
    {
      icon: Network,
      title: "Network Value",
      tagline: "First to Critical Mass Wins Winner-Take-Most Market",
      points: [
        "360+ health systems + 180 vendors = accelerating flywheel",
        "Each health system using procurement language drives 5-10 vendor certifications",
        "Network effects create 10-year moat",
        "Switching costs prohibitive once embedded",
      ],
    },
    {
      icon: Clock,
      title: "Time Value",
      tagline: "3-Year Head Start, 5 Years to Replicate",
      points: [
        "Translation engine: AI telemetry → HIPAA/NIST violations",
        "Would cost competitors $15M and 5 years to build",
        "Healthcare compliance expertise is rare + expensive",
        "Window is closing as standards crystallize",
      ],
    },
    {
      icon: Database,
      title: "Data Value",
      tagline: "Market Intelligence No One Else Has",
      points: [
        "Understanding of every major AI vendor's performance",
        "Benchmarking data across 360+ health systems",
        "Compliance violation patterns by vendor/specialty",
        "Predictive risk scoring based on 240+ model histories",
      ],
    },
  ];

  return (
    <section className="py-16 md:py-20 lg:py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Strategic Acquisition Value
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            This isn't software. <span className="font-semibold text-foreground">It's infrastructure that controls a $12B market.</span>
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {valueDrivers.map((driver, index) => (
            <Card
              key={index}
              className="p-6 md:p-8 hover-elevate transition-shadow"
              data-testid={`value-driver-${index}`}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <driver.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">{driver.title}</h3>
                  <p className="text-sm text-muted-foreground">{driver.tagline}</p>
                </div>
              </div>

              <ul className="space-y-2">
                {driver.points.map((point, pIndex) => (
                  <li key={pIndex} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-1">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <Card className="p-8 md:p-12 bg-background border-primary">
          <h3 className="text-2xl md:text-3xl font-bold mb-8 text-center">
            Integration Opportunities for Strategic Acquirers
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h4 className="font-bold mb-3">Epic Systems</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Works with Epic AI out-of-the-box</li>
                <li>• Extends Epic ecosystem governance</li>
                <li>• Becomes "Epic AI Trust" division</li>
                <li>• Prevents Microsoft/Philips from owning verification</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-3">Microsoft Health</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Native Azure Health integration</li>
                <li>• Compliance layer for Cloud for Healthcare</li>
                <li>• Bundles with existing offerings</li>
                <li>• Competitive moat vs. Google/AWS health</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-3">Philips Healthcare</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Certifies medical device AI</li>
                <li>• Extends HealthSuite ecosystem</li>
                <li>• Enables imaging AI governance at scale</li>
                <li>• Differentiation vs. GE/Siemens</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
