import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setMobileMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-sm bg-background/80 border-b">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">S</span>
            </div>
            <span className="font-bold text-xl">Spectral</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollToSection("health-systems")}
              className="text-sm font-medium hover-elevate px-3 py-2 rounded-md"
              data-testid="link-health-systems"
            >
              For Health Systems
            </button>
            <button
              onClick={() => scrollToSection("vendors")}
              className="text-sm font-medium hover-elevate px-3 py-2 rounded-md"
              data-testid="link-vendors"
            >
              For AI Vendors
            </button>
            <button
              onClick={() => scrollToSection("pricing")}
              className="text-sm font-medium hover-elevate px-3 py-2 rounded-md"
              data-testid="link-pricing"
            >
              Pricing
            </button>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="outline" data-testid="button-dashboard">
                Dashboard Demo
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => console.log("Talk to Expert clicked")}
              data-testid="button-talk-expert"
            >
              Talk to an Expert
            </Button>
            <Button
              onClick={() => scrollToSection("hero")}
              data-testid="button-get-started"
            >
              Get Started
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-2">
            <button
              onClick={() => scrollToSection("health-systems")}
              className="block w-full text-left px-3 py-2 hover-elevate rounded-md"
              data-testid="mobile-link-health-systems"
            >
              For Health Systems
            </button>
            <button
              onClick={() => scrollToSection("vendors")}
              className="block w-full text-left px-3 py-2 hover-elevate rounded-md"
              data-testid="mobile-link-vendors"
            >
              For AI Vendors
            </button>
            <button
              onClick={() => scrollToSection("pricing")}
              className="block w-full text-left px-3 py-2 hover-elevate rounded-md"
              data-testid="mobile-link-pricing"
            >
              Pricing
            </button>
            <div className="pt-2 space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => console.log("Talk to Expert clicked")}
                data-testid="mobile-button-talk-expert"
              >
                Talk to an Expert
              </Button>
              <Button
                className="w-full"
                onClick={() => scrollToSection("hero")}
                data-testid="mobile-button-get-started"
              >
                Get Started
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
