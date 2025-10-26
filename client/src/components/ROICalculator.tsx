import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function ROICalculator() {
  return (
    <section className="py-16 md:py-20 lg:py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Build vs. Buy: The Real Cost
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            Building AI governance infrastructure yourself costs <span className="font-semibold text-destructive">$15M + 5 years</span>. 
            See what Spectral saves you.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 mb-12">
          <Card className="p-6 md:p-8">
            <h3 className="text-2xl font-bold mb-6 text-destructive">
              Without Spectral:
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3" data-testid="cost-without-staff">
                <span className="text-muted-foreground">•</span>
                <span className="leading-relaxed">
                  Hire AI compliance staff: <span className="font-semibold">$410K/year</span>
                </span>
              </li>
              <li className="flex items-start gap-3" data-testid="cost-without-eval">
                <span className="text-muted-foreground">•</span>
                <span className="leading-relaxed">
                  Evaluate each vendor manually: <span className="font-semibold">6-12 months each</span>
                </span>
              </li>
              <li className="flex items-start gap-3" data-testid="cost-without-audit">
                <span className="text-muted-foreground">•</span>
                <span className="leading-relaxed">
                  Audit prep scramble: <span className="font-semibold">6 weeks every audit</span>
                </span>
              </li>
              <li className="flex items-start gap-3" data-testid="cost-without-board">
                <span className="text-muted-foreground">•</span>
                <span className="leading-relaxed">
                  Board asks questions you can't answer
                </span>
              </li>
            </ul>
          </Card>

          <Card className="p-6 md:p-8 border-primary">
            <h3 className="text-2xl font-bold mb-6 text-primary">
              With Spectral:
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3" data-testid="cost-with-platform">
                <span className="text-muted-foreground">•</span>
                <span className="leading-relaxed">
                  Platform: <span className="font-semibold">$200-400K/year</span>
                </span>
              </li>
              <li className="flex items-start gap-3" data-testid="cost-with-deploy">
                <span className="text-muted-foreground">•</span>
                <span className="leading-relaxed">
                  Deploy in weeks: <span className="font-semibold">Pre-verified vendors</span>
                </span>
              </li>
              <li className="flex items-start gap-3" data-testid="cost-with-audit">
                <span className="text-muted-foreground">•</span>
                <span className="leading-relaxed">
                  Always audit-ready: <span className="font-semibold">Automated evidence</span>
                </span>
              </li>
              <li className="flex items-start gap-3" data-testid="cost-with-board">
                <span className="text-muted-foreground">•</span>
                <span className="leading-relaxed">
                  Board gets real-time dashboard
                </span>
              </li>
            </ul>
          </Card>
        </div>

        <Card className="p-8 md:p-12 bg-primary text-primary-foreground text-center">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              Savings: $110-310K/year + 18-30 months faster deployment
            </h3>
            <Button
              size="lg"
              variant="outline"
              className="mt-6 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              onClick={() => window.location.href = 'mailto:sales@spectral.health?subject=ROI%20Calculation%20Request'}
              data-testid="button-calculate-savings"
            >
              Calculate Your Savings
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
