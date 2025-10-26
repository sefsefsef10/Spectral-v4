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
            Finally, Governance for Healthcare AI
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-4 leading-relaxed">
            Your board asks: "Are we compliant across all our AI?"
          </p>
          <p className="text-xl md:text-2xl font-semibold mb-8">
            Tomorrow, you can say: "Yes. Here's proof."
          </p>
          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            One platform to see, monitor, and prove compliance across every AI vendor—
            from Epic and OpenAI to imaging vendors and internal tools.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button
              size="lg"
              className="text-lg px-8 py-6 w-full sm:w-auto"
              onClick={handleSeeHowItWorks}
              data-testid="button-see-how-it-works"
            >
              See How It Works
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 w-full sm:w-auto backdrop-blur-sm bg-background/10"
              onClick={() => console.log("Talk to Expert clicked")}
              data-testid="button-talk-to-expert-hero"
            >
              Talk to an Expert
            </Button>
          </div>

          <div className="inline-flex flex-wrap items-center justify-center gap-6 md:gap-8 text-sm md:text-base bg-background/60 backdrop-blur-sm px-6 md:px-8 py-4 rounded-lg border">
            <div className="flex items-center gap-2" data-testid="stat-health-systems">
              <span className="font-semibold">5 health systems deployed</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <div className="flex items-center gap-2" data-testid="stat-models-verified">
              <span className="font-semibold">240+ AI models verified</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <div className="flex items-center gap-2" data-testid="stat-deployment-time">
              <span className="font-semibold">2-3 weeks to deployment</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
