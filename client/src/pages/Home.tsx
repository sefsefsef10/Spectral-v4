import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import MarketOpportunity from "@/components/MarketOpportunity";
import ProblemStatement from "@/components/ProblemStatement";
import SolutionPillars from "@/components/SolutionPillars";
import CompetitiveDifferentiation from "@/components/CompetitiveDifferentiation";
import StrategicValue from "@/components/StrategicValue";
import Testimonials from "@/components/Testimonials";
import ROICalculator from "@/components/ROICalculator";
import TrustSignals from "@/components/TrustSignals";
import Pricing from "@/components/Pricing";
import VendorProblem from "@/components/VendorProblem";
import VendorSolution from "@/components/VendorSolution";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <Hero />
        <MarketOpportunity />
        
        <div id="health-systems">
          <ProblemStatement />
          <SolutionPillars />
          <CompetitiveDifferentiation />
          <StrategicValue />
          <Testimonials />
          <ROICalculator />
          <TrustSignals />
        </div>

        <Pricing />

        <div id="vendors">
          <VendorProblem />
          <VendorSolution />
        </div>
      </main>
      <Footer />
    </div>
  );
}
