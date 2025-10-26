import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Bell, TrendingUp, Zap, Shield } from "lucide-react";
import { useLocation } from "wouter";

export default function SentinelPage() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: Bell,
      title: "Real-Time Alerts",
      description: "Instant notifications when AI systems deviate from expected behavior or compliance baselines",
    },
    {
      icon: TrendingUp,
      title: "Performance Monitoring",
      description: "Track accuracy, latency, and throughput metrics to detect degradation before it impacts patients",
    },
    {
      icon: Shield,
      title: "Security Scanning",
      description: "Continuous vulnerability assessment and threat detection for AI endpoints and data pipelines",
    },
    {
      icon: Zap,
      title: "Automated Response",
      description: "Configure workflows to automatically acknowledge, escalate, or remediate detected issues",
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 text-sm font-medium mb-6">
              <Bell className="w-4 h-4" />
              Continuous Monitoring
            </div>
            <h1 className="text-5xl font-bold mb-6">
              Sentinel
            </h1>
            <p className="text-2xl text-muted-foreground mb-8">
              Never miss a critical change. Real-time monitoring and alerts for every AI system in your portfolio.
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
            <h2 className="text-3xl font-bold mb-4">Stay ahead of AI risks</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Sentinel watches your AI systems 24/7 so you don't have to
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-orange-600" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Alert Types */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">What Sentinel detects</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl text-destructive">Critical</CardTitle>
                <CardDescription className="text-base">
                  Model drift detected, security vulnerability found, unauthorized configuration change
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-xl text-orange-600">High</CardTitle>
                <CardDescription className="text-base">
                  Performance degradation, compliance check failed, data quality issue detected
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-xl text-yellow-600">Medium</CardTitle>
                <CardDescription className="text-base">
                  Vendor update available, usage anomaly detected, certificate expiring soon
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold mb-1">Catch drift before it impacts patients</p>
                  <p className="text-muted-foreground">Detect model performance degradation in real-time</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold mb-1">Respond to security threats immediately</p>
                  <p className="text-muted-foreground">Automated scanning for vulnerabilities and unauthorized access</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold mb-1">Reduce alert fatigue with smart filtering</p>
                  <p className="text-muted-foreground">Only get notified about issues that matter</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold mb-1">Complete audit trail for every alert</p>
                  <p className="text-muted-foreground">Track detection, acknowledgment, and resolution</p>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-6">
                From detection to resolution in minutes
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Sentinel integrates with your existing workflows, sending alerts via email, Slack, or directly to your ticketing system.
              </p>
              <p className="text-lg text-muted-foreground">
                Configure custom alert rules, assign alerts to team members, and track resolution status—all from one dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Start monitoring your AI systems today
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Available in Growth and Enterprise plans
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
