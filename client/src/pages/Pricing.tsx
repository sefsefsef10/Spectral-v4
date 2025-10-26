import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useLocation } from "wouter";

export default function PricingPage() {
  const [, setLocation] = useLocation();

  const healthSystemTiers = [
    {
      name: "Foundation",
      price: "$75K",
      period: "/year",
      description: "For community hospitals starting their AI governance journey",
      features: [
        "1-3 AI systems monitored",
        "Basic compliance dashboard",
        "Quarterly compliance reports",
        "Email support",
        "HIPAA compliance tracking",
        "Basic vendor directory access",
      ],
      cta: "Contact Sales",
      popular: false,
    },
    {
      name: "Growth",
      price: "$200K",
      period: "/year",
      description: "Most popular for regional health systems",
      features: [
        "4-10 AI systems monitored",
        "Advanced compliance automation",
        "Monthly executive reporting",
        "Priority support + dedicated CSM",
        "HIPAA + NIST AI RMF + FDA tracking",
        "Spectral Verified vendor fast-track",
        "Board-ready compliance summaries",
        "API access for integrations",
      ],
      cta: "Contact Sales",
      popular: true,
    },
    {
      name: "Enterprise",
      price: "$400K",
      period: "/year",
      description: "For academic medical centers and large IDNs",
      features: [
        "11+ AI systems monitored",
        "Full compliance automation suite",
        "Real-time monitoring + alerts",
        "White-glove support + dedicated team",
        "All regulatory frameworks",
        "Custom policy enforcement",
        "Automated rollback capabilities",
        "Vendor certification management",
        "Multi-facility deployment",
        "Custom reporting + analytics",
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ];

  const vendorTiers = [
    {
      name: "Verified",
      price: "$15K",
      period: "/year",
      description: "Automated baseline certification",
      features: [
        "Automated security testing",
        "HIPAA compliance verification",
        "Public trust page",
        "Spectral Verified badge",
        "Quarterly re-verification",
        "Basic compliance report",
      ],
      cta: "Get Verified",
      popular: false,
    },
    {
      name: "Certified",
      price: "$50K",
      period: "/year",
      description: "Most popular for Series A-B healthcare AI companies",
      features: [
        "Everything in Verified",
        "Expert manual validation",
        "Clinical accuracy testing",
        "Bias detection analysis",
        "PHI leakage testing",
        "Detailed compliance report (20-40 pages)",
        "Sales enablement materials",
        "Priority certification queue",
      ],
      cta: "Get Certified",
      popular: true,
    },
    {
      name: "Trusted",
      price: "$100K",
      period: "/year",
      description: "Deep assurance for enterprise AI vendors",
      features: [
        "Everything in Certified",
        "Continuous monitoring",
        "Advanced threat testing",
        "Adversarial attack validation",
        "Custom compliance mappings",
        "Dedicated compliance advisor",
        "Quarterly re-certification",
        "Incident response support",
        "API integration support",
      ],
      cta: "Get Trusted",
      popular: false,
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
              <Button onClick={() => setLocation("/login")} data-testid="button-sign-in">
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12">
            Choose the plan that fits your organization. All plans include onboarding, training, and ongoing support.
          </p>
        </div>
      </section>

      {/* Health System Pricing */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">For Health Systems</h2>
            <p className="text-lg text-muted-foreground">
              Govern your entire AI portfolio with confidence
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {healthSystemTiers.map((tier) => (
              <Card
                key={tier.name}
                className={tier.popular ? "border-primary shadow-lg" : ""}
                data-testid={`card-tier-${tier.name.toLowerCase()}`}
              >
                {tier.popular && (
                  <div className="bg-primary text-primary-foreground text-sm font-medium text-center py-2 rounded-t-lg">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription className="text-base">{tier.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    <span className="text-muted-foreground">{tier.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={tier.popular ? "default" : "outline"}
                    data-testid={`button-${tier.name.toLowerCase()}-cta`}
                  >
                    {tier.cta}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Vendor Pricing */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">For AI Vendors</h2>
            <p className="text-lg text-muted-foreground">
              Get certified once, close deals everywhere
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {vendorTiers.map((tier) => (
              <Card
                key={tier.name}
                className={tier.popular ? "border-primary shadow-lg" : ""}
                data-testid={`card-vendor-tier-${tier.name.toLowerCase()}`}
              >
                {tier.popular && (
                  <div className="bg-primary text-primary-foreground text-sm font-medium text-center py-2 rounded-t-lg">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription className="text-base">{tier.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    <span className="text-muted-foreground">{tier.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={tier.popular ? "default" : "outline"}
                    data-testid={`button-vendor-${tier.name.toLowerCase()}-cta`}
                  >
                    {tier.cta}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-8">
            <div>
              <h3 className="font-semibold text-lg mb-2">How does pricing scale with more AI systems?</h3>
              <p className="text-muted-foreground">
                Our tiers are designed to grow with you. As you add more AI systems to your portfolio, we'll work with you to find the right tier or create a custom enterprise plan.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">What's included in implementation?</h3>
              <p className="text-muted-foreground">
                All plans include full onboarding, training for your team, integration support, and ongoing customer success. Most customers are fully deployed within 2-3 weeks.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Can I try Spectral before committing?</h3>
              <p className="text-muted-foreground">
                Yes! We offer a 30-day pilot program for qualified health systems. Contact sales to learn more about our pilot options.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">How does vendor certification work?</h3>
              <p className="text-muted-foreground">
                Vendors submit their AI system for testing, we run automated and manual validation tests, and upon passing, issue a Spectral Verified badge with a public trust page and detailed compliance report.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to get started?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join 5 health systems and 15+ AI vendors already using Spectral
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" data-testid="button-contact-sales-footer">
              Contact Sales
            </Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/dashboard")} data-testid="button-view-demo">
              View Dashboard Demo
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
