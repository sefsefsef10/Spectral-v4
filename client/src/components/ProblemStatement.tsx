import { X } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function ProblemStatement() {
  const problems = [
    "Epic AI built into your EHR",
    "3-5 imaging AI vendors (radiology, pathology)",
    "Documentation tools (ambient scribes, clinical notes)",
    "Internal productivity platforms",
    "Point solutions you forgot about",
  ];

  const cisoQuestions = [
    "What AI do we have deployed?",
    "Is it HIPAA compliant?",
    "Are we monitoring for PHI leakage?",
    "Can we prove this to auditors?",
  ];

  const procurementIssues = [
    "Evaluating vendor #8 with the same 120 questions",
    "Waiting 6 months per security review",
    "No standardized process",
    "Every vendor evaluation starts from scratch",
  ];

  return (
    <section className="py-16 md:py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Your AI Problem Right Now
          </h2>
          <p className="text-xl md:text-2xl font-semibold text-muted-foreground">
            You're deploying AI faster than you can govern it.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 mb-12">
          <div>
            <h3 className="text-xl font-semibold mb-6">You probably have:</h3>
            <ul className="space-y-3">
              {problems.map((problem, index) => (
                <li key={index} className="flex items-start gap-3" data-testid={`problem-${index}`}>
                  <span className="text-muted-foreground mt-1">•</span>
                  <span className="text-lg leading-relaxed">{problem}</span>
                </li>
              ))}
            </ul>
          </div>

          <Card className="p-6 md:p-8">
            <h3 className="text-xl font-semibold mb-6 text-destructive">
              Your CISO can't answer basic questions:
            </h3>
            <ul className="space-y-4">
              {cisoQuestions.map((question, index) => (
                <li key={index} className="flex items-start gap-3" data-testid={`ciso-question-${index}`}>
                  <X className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">"{question}"</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="p-6 md:p-8">
          <h3 className="text-xl font-semibold mb-6 text-destructive">
            Your procurement team is stuck:
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {procurementIssues.map((issue, index) => (
              <div key={index} className="flex items-start gap-3" data-testid={`procurement-issue-${index}`}>
                <X className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{issue}</span>
              </div>
            ))}
          </div>
        </Card>

        <p className="text-center text-xl md:text-2xl font-semibold mt-12">
          Your board is asking questions you can't answer.
        </p>
      </div>
    </section>
  );
}
