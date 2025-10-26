import { Button } from "@/components/ui/button";

export default function Footer() {
  return (
    <footer className="bg-muted/30 border-t">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 md:py-16">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">S</span>
              </div>
              <span className="font-bold text-xl">Spectral</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Enabling AI governance for healthcare organizations.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Solutions</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => {
                    const el = document.getElementById("health-systems");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="text-muted-foreground hover-elevate px-2 py-1 rounded-md"
                  data-testid="footer-link-health-systems"
                >
                  For Health Systems
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    const el = document.getElementById("vendors");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="text-muted-foreground hover-elevate px-2 py-1 rounded-md"
                  data-testid="footer-link-vendors"
                >
                  For AI Vendors
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="text-muted-foreground hover-elevate px-2 py-1 rounded-md"
                  data-testid="footer-link-about"
                >
                  About
                </button>
              </li>
              <li>
                <button
                  onClick={() => window.location.href = 'mailto:careers@spectral.health'}
                  className="text-muted-foreground hover-elevate px-2 py-1 rounded-md"
                  data-testid="footer-link-careers"
                >
                  Careers
                </button>
              </li>
              <li>
                <button
                  onClick={() => window.location.href = 'mailto:contact@spectral.health'}
                  className="text-muted-foreground hover-elevate px-2 py-1 rounded-md"
                  data-testid="footer-link-contact"
                >
                  Contact
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Get Started</h4>
            <Button
              onClick={() => window.location.href = 'mailto:sales@spectral.health?subject=Demo%20Request'}
              className="w-full mb-3"
              data-testid="footer-button-demo"
            >
              Schedule a Demo
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = 'mailto:sales@spectral.health?subject=Expert%20Consultation%20Request'}
              className="w-full"
              data-testid="footer-button-expert"
            >
              Talk to an Expert
            </Button>
          </div>
        </div>

        <div className="pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; 2024 Spectral. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
