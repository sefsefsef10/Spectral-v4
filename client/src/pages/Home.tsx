import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import ProblemStatement from "@/components/ProblemStatement";
import SolutionPillars from "@/components/SolutionPillars";
import Testimonials from "@/components/Testimonials";
import ROICalculator from "@/components/ROICalculator";
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
        
        <div id="health-systems">
          <ProblemStatement />
          <SolutionPillars />
          <Testimonials />
          <ROICalculator />
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
