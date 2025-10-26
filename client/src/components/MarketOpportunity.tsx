import { Card } from "@/components/ui/card";
import { TrendingUp, Building2, Users, DollarSign } from "lucide-react";

export default function MarketOpportunity() {
  const marketStats = [
    {
      icon: DollarSign,
      value: "$150B",
      label: "Coordination Failure",
      description: "Duplicate evaluations across healthcare AI procurement",
    },
    {
      icon: Building2,
      value: "6,000",
      label: "U.S. Hospitals",
      description: "Each evaluating 50+ AI vendors independently",
    },
    {
      icon: Users,
      value: "300,000",
      label: "Duplicate Reviews",
      description: "Same security questions asked over and over",
    },
    {
      icon: TrendingUp,
      value: "$12B",
      label: "Market Size",
      description: "Healthcare AI governance infrastructure opportunity",
    },
  ];

  return (
    <section className="py-16 md:py-20 lg:py-24 bg-primary/5">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            The $150B Coordination Failure
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            Every hospital independently evaluating every AI vendor. 
            <span className="font-semibold text-foreground"> Spectral solves this at scale.</span>
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-12">
          {marketStats.map((stat, index) => (
            <Card
              key={index}
              className="p-6 md:p-8 text-center hover-elevate transition-shadow"
              data-testid={`market-stat-${index}`}
            >
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <stat.icon className="w-6 h-6 text-primary" />
              </div>
              <div className="text-3xl md:text-4xl font-bold mb-2">{stat.value}</div>
              <div className="font-semibold mb-2">{stat.label}</div>
              <p className="text-sm text-muted-foreground">{stat.description}</p>
            </Card>
          ))}
        </div>

        <Card className="p-8 md:p-12 bg-background">
          <h3 className="text-2xl md:text-3xl font-bold mb-6 text-center">
            Whoever Owns Verification Controls Market Access
          </h3>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold text-primary mb-2">1x</div>
              <p className="font-semibold mb-2">Evaluate Once</p>
              <p className="text-sm text-muted-foreground">
                Vendors get certified through Spectral's independent verification
              </p>
            </div>
            <div>
              <div className="text-5xl font-bold text-primary mb-2">360+</div>
              <p className="font-semibold mb-2">Trust Network</p>
              <p className="text-sm text-muted-foreground">
                Health systems accept "Spectral Verified" vendors instantly
              </p>
            </div>
            <div>
              <div className="text-5xl font-bold text-primary mb-2">∞</div>
              <p className="font-semibold mb-2">Network Effects</p>
              <p className="text-sm text-muted-foreground">
                More health systems = more vendors must certify = stronger moat
              </p>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
