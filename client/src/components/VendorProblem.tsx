import { Card } from "@/components/ui/card";

export default function VendorProblem() {
  const requirements = [
    "120-question security questionnaire",
    "Architecture review",
    "PHI handling documentation",
    "Bias testing results",
    "Clinical validation studies",
    "HIPAA compliance proof",
    "References from other health systems",
  ];

  return (
    <section className="py-16 md:py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Your Sales Problem Right Now
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            You've closed the champion. They love your product.
          </p>
        </div>

        <Card className="p-8 md:p-12 max-w-4xl mx-auto mb-8">
          <p className="text-lg leading-relaxed mb-6">
            Then procurement asks for:
          </p>
          <ul className="space-y-3 mb-8">
            {requirements.map((requirement, index) => (
              <li key={index} className="flex items-start gap-3" data-testid={`requirement-${index}`}>
                <span className="text-muted-foreground mt-1">•</span>
                <span className="leading-relaxed">{requirement}</span>
              </li>
            ))}
          </ul>
          <p className="text-xl font-semibold text-center mb-4">
            6 months later, you're still answering questions.
          </p>
          <p className="text-xl font-semibold text-center text-destructive">
            The deal dies in security review. Again.
          </p>
        </Card>
      </div>
    </section>
  );
}
