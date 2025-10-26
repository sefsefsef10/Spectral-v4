import { Card } from "@/components/ui/card";
import { Quote } from "lucide-react";

export default function Testimonials() {
  const testimonials = [
    {
      quote: "We discovered 23 AI deployments. We thought we had 8.",
      role: "CISO",
      organization: "500-bed hospital",
    },
    {
      quote: "Board meeting prep went from 6 weeks to 2 hours.",
      role: "VP Compliance",
      organization: "Academic Medical Center",
    },
    {
      quote: "PHI pattern detected in vendor output. Spectral caught it, rolled back automatically. Breach prevented.",
      role: "CIO",
      organization: "Regional Health System",
    },
  ];

  return (
    <section className="py-16 md:py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Real Results
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <Card
              key={index}
              className="p-6 md:p-8 hover-elevate transition-shadow"
              data-testid={`testimonial-${index}`}
            >
              <Quote className="w-8 h-8 text-primary/20 mb-4" />
              <blockquote className="text-lg leading-relaxed mb-6">
                "{testimonial.quote}"
              </blockquote>
              <div className="text-sm">
                <div className="font-semibold" data-testid={`testimonial-${index}-role`}>
                  {testimonial.role}
                </div>
                <div className="text-muted-foreground" data-testid={`testimonial-${index}-org`}>
                  {testimonial.organization}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
