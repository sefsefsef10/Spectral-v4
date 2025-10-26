import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Award, TrendingUp, Users, Star } from "lucide-react";
import { useLocation } from "wouter";

export default function BeaconPage() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: Award,
      title: "Spectral Verified Badge",
      description: "Earn a trust badge that health systems recognize and require in their procurement process",
    },
    {
      icon: TrendingUp,
      title: "Sales Enablement",
      description: "Get detailed compliance reports and trust pages to accelerate your sales cycle",
    },
    {
      icon: Users,
      title: "Public Directory Listing",
      description: "Appear in the Spectral Verified directory where health systems search for trusted AI vendors",
    },
    {
      icon: Star,
      title: "Continuous Re-Verification",
      description: "Maintain your certification with ongoing testing and quarterly re-verification",
    },
  ];

  const certificationLevels = [
    {
      name: "Verified",
      price: "$15K/year",
      description: "Automated baseline certification",
      features: [
        "Automated security testing",
        "HIPAA compliance verification",
        "Public trust page",
        "Spectral Verified badge",
        "Quarterly re-verification",
      ],
    },
    {
      name: "Certified",
      price: "$50K/year",
      description: "Expert manual validation (Most Popular)",
      features: [
        "Everything in Verified",
        "Expert manual validation",
        "Clinical accuracy testing",
        "Bias detection analysis",
        "PHI leakage testing",
        "20-40 page detailed report",
        "Sales enablement materials",
      ],
    },
    {
      name: "Trusted",
      price: "$100K/year",
      description: "Deep assurance for enterprise vendors",
      features: [
        "Everything in Certified",
        "Continuous monitoring",
        "Advanced threat testing",
        "Adversarial attack validation",
        "Custom compliance mappings",
        "Dedicated compliance advisor",
        "Quarterly re-certification",
      ],
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 text-sm font-medium mb-6">
              <Award className="w-4 h-4" />
              Vendor Certification
            </div>
            <h1 className="text-5xl font-bold mb-6">
              Beacon
            </h1>
            <p className="text-2xl text-muted-foreground mb-8">
              Get certified once, close deals everywhere. The trust badge that health systems actually look for.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" onClick={() => setLocation("/pricing")} data-testid="button-get-started">
                Start Certification
              </Button>
              <Button size="lg" variant="outline" data-testid="button-learn-more">
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-bold mb-6">
              Health systems are asking: "Are you Spectral Verified?"
            </h2>
            <p className="text-xl text-muted-foreground">
              Every AI vendor goes through the same painful compliance questions in every sales cycle. Beacon gives you one certification that works everywhere.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-purple-600" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Certification Process */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How certification works</h2>
            <p className="text-lg text-muted-foreground">
              From submission to Spectral Verified in 2-4 weeks
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="font-semibold mb-2">Submit Application</h3>
              <p className="text-sm text-muted-foreground">
                Complete our vendor intake form with your product details
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="font-semibold mb-2">Security Testing</h3>
              <p className="text-sm text-muted-foreground">
                We run automated and manual security assessments
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="font-semibold mb-2">Expert Review</h3>
              <p className="text-sm text-muted-foreground">
                Our team validates compliance and clinical safety
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                4
              </div>
              <h3 className="font-semibold mb-2">Get Certified</h3>
              <p className="text-sm text-muted-foreground">
                Receive your badge, trust page, and detailed report
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ROI */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">
                Turn compliance from a cost center into a revenue driver
              </h2>
              <div className="space-y-6">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">Shorten sales cycles by 3-6 months</p>
                    <p className="text-muted-foreground">Skip repetitive compliance questionnaires with one trusted certification</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">Win more deals</p>
                    <p className="text-muted-foreground">Health systems increasingly require Spectral Verified certification</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">Reduce compliance overhead</p>
                    <p className="text-muted-foreground">One certification replaces dozens of custom security reviews</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">Stand out in RFPs</p>
                    <p className="text-muted-foreground">Display your Spectral Verified badge in proposals and marketing</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-8 border">
              <h3 className="text-2xl font-bold mb-6">By the numbers</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-bold">3-6</span>
                    <span className="text-xl text-muted-foreground">months</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Average reduction in sales cycle length</p>
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-bold">85%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Of health systems check for third-party certification</p>
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-bold">$200K</span>
                    <span className="text-xl text-muted-foreground">+</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Average value of first deal closed faster with certification</p>
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
            Join 15+ AI vendors already Spectral Verified
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Start your certification in minutes
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => setLocation("/pricing")} data-testid="button-start-certification">
              Start Certification
            </Button>
            <Button size="lg" variant="outline" data-testid="button-contact-sales">
              Talk to Sales
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
