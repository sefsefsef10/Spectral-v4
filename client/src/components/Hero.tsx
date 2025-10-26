import { Button } from "@/components/ui/button";

export default function Hero() {
  const handleSeeHowItWorks = () => {
    const element = document.getElementById("health-systems");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="hero" className="relative min-h-[85vh] flex items-center bg-gradient-to-b from-muted/30 to-background">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 md:py-24 lg:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            Independent Verification Infrastructure for Healthcare AI
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-4 leading-relaxed">
            Like SOC 2 auditors for healthcare AI. Whoever owns verification controls market access.
          </p>
          <p className="text-xl md:text-2xl font-semibold mb-8">
            The standard health systems trust. The certification AI vendors need.
          </p>
          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            360+ health systems and 180 AI vendors on our verification standard.
            We translate AI telemetry into HIPAA/NIST compliance—solving the $150B coordination failure in healthcare AI governance.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button
              size="lg"
              className="text-lg px-8 py-6 w-full sm:w-auto"
              onClick={handleSeeHowItWorks}
              data-testid="button-see-how-it-works"
            >
              See the Verification Standard
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 w-full sm:w-auto backdrop-blur-sm bg-background/10"
              onClick={() => console.log("Calculate savings clicked")}
              data-testid="button-calculate-savings-hero"
            >
              Calculate Your Savings
            </Button>
          </div>

          <div className="inline-flex flex-wrap items-center justify-center gap-6 md:gap-8 text-sm md:text-base bg-background/60 backdrop-blur-sm px-6 md:px-8 py-4 rounded-lg border">
            <div className="flex items-center gap-2" data-testid="stat-health-systems">
              <span className="font-semibold">360+ health systems</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <div className="flex items-center gap-2" data-testid="stat-models-verified">
              <span className="font-semibold">180 certified vendors</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <div className="flex items-center gap-2" data-testid="stat-deployment-time">
              <span className="font-semibold">Network effects accelerating</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
