import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, FileCheck, Book, Download, Shield } from "lucide-react";
import { useLocation } from "wouter";

export default function WatchtowerPage() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: FileCheck,
      title: "Framework Mapping",
      description: "Automatically map your AI systems to HIPAA, NIST AI RMF, FDA, and other regulatory requirements",
    },
    {
      icon: Book,
      title: "Compliance Checklists",
      description: "Pre-built checklists for each framework with evidence collection and status tracking",
    },
    {
      icon: Download,
      title: "Audit Export",
      description: "One-click export of compliance reports in PDF or CSV format for regulators and auditors",
    },
    {
      icon: Shield,
      title: "Continuous Validation",
      description: "Automated checks to ensure ongoing compliance as systems evolve and regulations change",
    },
  ];

  const frameworks = [
    {
      name: "HIPAA",
      description: "Privacy, security, and breach notification rules for protected health information",
      coverage: "100%",
    },
    {
      name: "NIST AI RMF",
      description: "AI Risk Management Framework for trustworthy and responsible AI development",
      coverage: "100%",
    },
    {
      name: "FDA Guidelines",
      description: "Software as a Medical Device (SaMD) and Clinical Decision Support requirements",
      coverage: "95%",
    },
    {
      name: "SOC 2 Type II",
      description: "Security, availability, and confidentiality controls for service organizations",
      coverage: "90%",
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-sm font-medium mb-6">
              <Shield className="w-4 h-4" />
              Compliance Automation
            </div>
            <h1 className="text-5xl font-bold mb-6">
              Watchtower
            </h1>
            <p className="text-2xl text-muted-foreground mb-8">
              Compliance on autopilot. Map every AI system to HIPAA, NIST AI RMF, FDA, and more—without the manual spreadsheets.
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
            <h2 className="text-3xl font-bold mb-4">Compliance made simple</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Replace manual tracking with automated compliance verification
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Frameworks Coverage */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Supported regulatory frameworks</h2>
            <p className="text-lg text-muted-foreground">
              Pre-built mappings for the most common healthcare AI compliance requirements
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {frameworks.map((framework) => (
              <Card key={framework.name}>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-xl">{framework.name}</CardTitle>
                    <span className="text-sm font-medium text-primary">{framework.coverage} covered</span>
                  </div>
                  <CardDescription className="text-base">{framework.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">
                From audit prep to audit-ready in hours
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Watchtower automatically collects evidence, tracks compliance status, and generates audit-ready reports—saving your team weeks of manual work.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">Pre-built compliance templates</p>
                    <p className="text-muted-foreground">Start with expert-designed checklists for each framework</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">Automated evidence collection</p>
                    <p className="text-muted-foreground">Pull documentation, logs, and certifications automatically</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">One-click audit reports</p>
                    <p className="text-muted-foreground">Export comprehensive compliance summaries in seconds</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-8 border">
              <h3 className="font-semibold mb-4">Sample Compliance Report</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-background rounded border">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-600"></div>
                    <span className="font-medium">HIPAA Privacy Rule</span>
                  </div>
                  <span className="text-sm text-green-600">100%</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-background rounded border">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-600"></div>
                    <span className="font-medium">HIPAA Security Rule</span>
                  </div>
                  <span className="text-sm text-green-600">100%</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-background rounded border">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-yellow-600"></div>
                    <span className="font-medium">NIST AI RMF</span>
                  </div>
                  <span className="text-sm text-yellow-600">85%</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-background rounded border">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-600"></div>
                    <span className="font-medium">FDA SaMD</span>
                  </div>
                  <span className="text-sm text-green-600">95%</span>
                </div>
              </div>
              <Button className="w-full mt-6" variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export Full Report
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Simplify your compliance process
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Available in all Spectral plans
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
