import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Shield, BarChart3, AlertTriangle, Clock } from "lucide-react";
import { useLocation } from "wouter";

export default function ConstellationPage() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: BarChart3,
      title: "Portfolio Overview",
      description: "See all AI systems in one place with real-time status, risk levels, and compliance state",
    },
    {
      icon: Shield,
      title: "Risk Assessment",
      description: "Automated risk scoring (Low/Medium/High/Critical) based on clinical impact and data access",
    },
    {
      icon: AlertTriangle,
      title: "Drift Detection",
      description: "Monitor for unauthorized changes to model parameters, training data, or inference behavior",
    },
    {
      icon: Clock,
      title: "Executive Reporting",
      description: "Board-ready compliance summaries with exportable reports and audit trails",
    },
  ];

  const useCases = [
    {
      title: "Academic Medical Centers",
      description: "Manage 15+ AI systems across radiology, pathology, oncology, and Epic embedded models",
    },
    {
      title: "Regional Health Systems",
      description: "Track 5-10 AI vendors with centralized compliance monitoring and vendor performance metrics",
    },
    {
      title: "Community Hospitals",
      description: "Start with 1-3 critical AI systems and scale as your AI portfolio grows",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/")}>
              <div className="w-8 h-8 rounded bg-foreground flex items-center justify-center">
                <span className="text-background font-bold text-sm">S</span>
              </div>
              <span className="font-semibold text-xl">Spectral</span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setLocation("/")} data-testid="button-back-home">
                Back to Home
              </Button>
              <Button onClick={() => setLocation("/pricing")} data-testid="button-pricing">
                View Pricing
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <BarChart3 className="w-4 h-4" />
              Portfolio Management
            </div>
            <h1 className="text-5xl font-bold mb-6">
              Constellation
            </h1>
            <p className="text-2xl text-muted-foreground mb-8">
              Your complete AI portfolio in one place. See, monitor, and govern every AI system across your health system.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" onClick={() => setLocation("/pricing")} data-testid="button-get-started">
                Get Started
              </Button>
              <Button size="lg" variant="outline" onClick={() => setLocation("/dashboard")} data-testid="button-view-demo">
                View Dashboard Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything you need to manage AI systems</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From initial assessment to continuous monitoring, Constellation gives you complete visibility
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Built for health systems of all sizes</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {useCases.map((useCase) => (
              <Card key={useCase.title}>
                <CardHeader>
                  <CardTitle className="text-xl">{useCase.title}</CardTitle>
                  <CardDescription className="text-base">{useCase.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Key Capabilities */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">
                Answer the board's toughest questions
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">"Are we compliant across all our AI?"</p>
                    <p className="text-muted-foreground">Real-time compliance dashboard with evidence trails</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">"Which AI systems pose the highest risk?"</p>
                    <p className="text-muted-foreground">Automated risk scoring with clinical impact analysis</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">"How do we know if a model has drifted?"</p>
                    <p className="text-muted-foreground">Continuous monitoring with automated drift alerts</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">"Can you show me an audit trail?"</p>
                    <p className="text-muted-foreground">Complete history with exportable reports for regulators</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-8 border">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-background rounded border">
                  <div>
                    <p className="font-semibold">Total AI Systems</p>
                    <p className="text-3xl font-bold">12</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="flex items-center justify-between p-4 bg-background rounded border">
                  <div>
                    <p className="font-semibold">Compliant</p>
                    <p className="text-3xl font-bold text-green-600">10</p>
                  </div>
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <div className="flex items-center justify-between p-4 bg-background rounded border">
                  <div>
                    <p className="font-semibold">Needs Attention</p>
                    <p className="text-3xl font-bold text-yellow-600">2</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-yellow-600" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to govern your AI portfolio?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join 5 health systems already using Constellation
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => setLocation("/pricing")} data-testid="button-view-pricing">
              View Pricing
            </Button>
            <Button size="lg" variant="outline" data-testid="button-contact-sales">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
