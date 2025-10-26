import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Award, CheckCircle2, Shield, Star, Plus, X, FileText } from "lucide-react";
import type { CertificationApplication } from "@shared/schema";

const CERTIFICATION_TIERS = [
  {
    id: "Silver",
    name: "Silver",
    description: "Basic HIPAA compliance verification",
    requirements: [
      "1+ documentation URLs",
      "HIPAA compliance statement",
      "Basic deployment history",
    ],
    frameworks: ["HIPAA"],
    icon: Shield,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
  },
  {
    id: "Gold",
    name: "Gold",
    description: "Enhanced validation with NIST AI RMF",
    requirements: [
      "2+ documentation URLs",
      "HIPAA + NIST AI RMF compliance statements",
      "Technical architecture documentation",
    ],
    frameworks: ["HIPAA", "NIST AI RMF"],
    icon: Award,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
  },
  {
    id: "Platinum",
    name: "Platinum",
    description: "Comprehensive certification with FDA/ISO standards",
    requirements: [
      "3+ documentation URLs",
      "HIPAA + NIST AI RMF + FDA/ISO compliance statements",
      "Clinical validation studies",
      "Third-party audit reports",
    ],
    frameworks: ["HIPAA", "NIST AI RMF", "FDA SaMD / ISO 13485"],
    icon: Star,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
];

export default function CertificationIntakeView() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [documentationUrls, setDocumentationUrls] = useState<string[]>([""]);
  const [complianceStatements, setComplianceStatements] = useState({
    hipaa: "",
    nist: "",
    fda: "",
  });

  const vendorId = user?.vendorId || "";

  const { data: applications = [] } = useQuery<CertificationApplication[]>({
    queryKey: ["/api/vendors", vendorId, "certifications", "applications"],
    enabled: !!vendorId,
  });

  const applyMutation = useMutation({
    mutationFn: async (data: { tierRequested: string; documentationUrls: string[]; complianceStatements: Record<string, string> }) => {
      return apiRequest("POST", `/api/vendors/${vendorId}/certifications/apply`, data);
    },
    onSuccess: () => {
      toast({
        title: "Application Submitted",
        description: "Your certification application has been submitted for automated testing and review.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId, "certifications", "applications"] });
      resetForm();
    },
    onError: () => {
      toast({
        title: "Application Failed",
        description: "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setStep(1);
    setSelectedTier("");
    setDocumentationUrls([""]);
    setComplianceStatements({ hipaa: "", nist: "", fda: "" });
  };

  const handleAddDocUrl = () => {
    setDocumentationUrls([...documentationUrls, ""]);
  };

  const handleRemoveDocUrl = (index: number) => {
    setDocumentationUrls(documentationUrls.filter((_, i) => i !== index));
  };

  const handleDocUrlChange = (index: number, value: string) => {
    const updated = [...documentationUrls];
    updated[index] = value;
    setDocumentationUrls(updated);
  };

  const handleSubmit = () => {
    const filteredUrls = documentationUrls.filter(url => url.trim() !== "");
    
    if (!selectedTier) {
      toast({
        title: "Validation Error",
        description: "Please select a certification tier",
        variant: "destructive",
      });
      return;
    }

    if (filteredUrls.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please provide at least one documentation URL",
        variant: "destructive",
      });
      return;
    }

    applyMutation.mutate({
      tierRequested: selectedTier,
      documentationUrls: filteredUrls,
      complianceStatements,
    });
  };

  const isStepComplete = (stepNumber: number): boolean => {
    if (stepNumber === 1) return !!selectedTier;
    if (stepNumber === 2) return documentationUrls.some(url => url.trim() !== "");
    if (stepNumber === 3) {
      if (selectedTier === "Silver") return !!complianceStatements.hipaa;
      if (selectedTier === "Gold") return !!complianceStatements.hipaa && !!complianceStatements.nist;
      if (selectedTier === "Platinum") return !!complianceStatements.hipaa && !!complianceStatements.nist && !!complianceStatements.fda;
    }
    return false;
  };

  const renderApplicationsList = () => {
    if (applications.length === 0) {
      return (
        <Card className="p-8 text-center">
          <Award className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Applications Yet</h3>
          <p className="text-muted-foreground mb-4">
            Apply for Spectral Verified certification to demonstrate compliance to healthcare customers
          </p>
          <Button onClick={() => setStep(1)} data-testid="button-start-application">
            Start Application
          </Button>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Your Applications</h3>
          <Button onClick={() => setStep(1)} data-testid="button-new-application">
            <Plus className="w-4 h-4 mr-2" />
            New Application
          </Button>
        </div>
        <div className="space-y-3">
          {applications.map((app) => (
            <Card key={app.id} className="p-4" data-testid={`application-${app.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${
                    app.tierRequested === "Platinum" ? "bg-purple-100" :
                    app.tierRequested === "Gold" ? "bg-yellow-100" : "bg-gray-100"
                  } rounded-lg flex items-center justify-center`}>
                    <Award className={`w-6 h-6 ${
                      app.tierRequested === "Platinum" ? "text-purple-600" :
                      app.tierRequested === "Gold" ? "text-yellow-600" : "text-gray-600"
                    }`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{app.tierRequested} Certification</h4>
                      <Badge variant={
                        app.status === "approved" ? "default" :
                        app.status === "rejected" ? "destructive" :
                        app.status === "in_review" ? "secondary" : "outline"
                      } data-testid={`status-${app.id}`}>
                        {app.status === "in_review" ? "In Review" : 
                         app.status === "approved" ? "Approved" :
                         app.status === "rejected" ? "Rejected" : "Pending"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Submitted {new Date(app.createdAt || "").toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {app.automatedChecksResult && (
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      Automated Score: {JSON.parse(app.automatedChecksResult).score}/100
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {JSON.parse(app.automatedChecksResult).passed ? "✓ Tests Passed" : "✗ Tests Failed"}
                    </div>
                  </div>
                )}
              </div>
              {app.rejectionReason && (
                <div className="mt-3 p-3 bg-destructive/10 rounded-md">
                  <p className="text-sm text-destructive font-medium">Rejection Reason:</p>
                  <p className="text-sm text-muted-foreground">{app.rejectionReason}</p>
                </div>
              )}
              {app.reviewedAt && (
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium">Reviewed:</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(app.reviewedAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    );
  };

  if (step === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Spectral Verified Certification</h1>
          <p className="text-muted-foreground">
            Apply for Spectral Verified certification to demonstrate your AI product's healthcare compliance
          </p>
        </div>
        {renderApplicationsList()}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Apply for Certification</h1>
          <p className="text-muted-foreground">
            Complete the application to get Spectral Verified
          </p>
        </div>
        <Button variant="outline" onClick={() => setStep(0)} data-testid="button-view-applications">
          <FileText className="w-4 h-4 mr-2" />
          View Applications
        </Button>
      </div>

      <div className="flex gap-4 mb-8">
        {[1, 2, 3].map((stepNum) => (
          <div key={stepNum} className="flex-1">
            <div className={`flex items-center gap-2 p-3 rounded-lg border-2 ${
              step === stepNum ? "border-primary bg-primary/5" : 
              isStepComplete(stepNum) ? "border-green-500 bg-green-50" :
              "border-border"
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === stepNum ? "bg-primary text-primary-foreground" :
                isStepComplete(stepNum) ? "bg-green-500 text-white" :
                "bg-muted text-muted-foreground"
              }`}>
                {isStepComplete(stepNum) ? <CheckCircle2 className="w-4 h-4" /> : stepNum}
              </div>
              <div className="text-sm font-medium">
                {stepNum === 1 ? "Choose Tier" : stepNum === 2 ? "Documentation" : "Compliance Statements"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Select Certification Tier</h2>
          <div className="grid gap-4">
            {CERTIFICATION_TIERS.map((tier) => {
              const Icon = tier.icon;
              return (
                <Card
                  key={tier.id}
                  className={`p-6 cursor-pointer hover-elevate ${
                    selectedTier === tier.id ? "border-2 border-primary" : ""
                  }`}
                  onClick={() => setSelectedTier(tier.id)}
                  data-testid={`tier-${tier.id}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 ${tier.bgColor} rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${tier.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{tier.name}</h3>
                        {selectedTier === tier.id && (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <p className="text-muted-foreground mb-3">{tier.description}</p>
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Requirements:</div>
                        <ul className="space-y-1">
                          {tier.requirements.map((req, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                              <CheckCircle2 className="w-3 h-3 text-green-600" />
                              {req}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {tier.frameworks.map((framework) => (
                          <Badge key={framework} variant="secondary">
                            {framework}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep(0)} data-testid="button-cancel">Cancel</Button>
            <Button onClick={() => setStep(2)} disabled={!selectedTier} data-testid="button-next-tier">
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Documentation URLs</h2>
          <p className="text-muted-foreground">
            Provide links to your technical documentation, security assessments, and compliance materials
          </p>
          <div className="space-y-3">
            {documentationUrls.map((url, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="https://example.com/documentation.pdf"
                  value={url}
                  onChange={(e) => handleDocUrlChange(index, e.target.value)}
                  data-testid={`input-doc-url-${index}`}
                />
                {documentationUrls.length > 1 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveDocUrl(index)}
                    data-testid={`button-remove-url-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={handleAddDocUrl} data-testid="button-add-url">
            <Plus className="w-4 h-4 mr-2" />
            Add Another URL
          </Button>
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(1)} data-testid="button-back-docs">
              Back
            </Button>
            <Button onClick={() => setStep(3)} disabled={!isStepComplete(2)} data-testid="button-next-docs">
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Compliance Statements</h2>
          <p className="text-muted-foreground">
            Describe how your AI system complies with each framework
          </p>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hipaa">HIPAA Compliance Statement *</Label>
              <Textarea
                id="hipaa"
                placeholder="Describe your HIPAA compliance approach, safeguards, and policies..."
                value={complianceStatements.hipaa}
                onChange={(e) => setComplianceStatements({ ...complianceStatements, hipaa: e.target.value })}
                rows={4}
                data-testid="textarea-hipaa"
              />
            </div>

            {(selectedTier === "Gold" || selectedTier === "Platinum") && (
              <div className="space-y-2">
                <Label htmlFor="nist">NIST AI RMF Compliance Statement *</Label>
                <Textarea
                  id="nist"
                  placeholder="Describe your NIST AI RMF compliance, risk management framework, and AI governance..."
                  value={complianceStatements.nist}
                  onChange={(e) => setComplianceStatements({ ...complianceStatements, nist: e.target.value })}
                  rows={4}
                  data-testid="textarea-nist"
                />
              </div>
            )}

            {selectedTier === "Platinum" && (
              <div className="space-y-2">
                <Label htmlFor="fda">FDA SaMD / ISO 13485 Compliance Statement *</Label>
                <Textarea
                  id="fda"
                  placeholder="Describe your FDA SaMD classification or ISO 13485 certification..."
                  value={complianceStatements.fda}
                  onChange={(e) => setComplianceStatements({ ...complianceStatements, fda: e.target.value })}
                  rows={4}
                  data-testid="textarea-fda"
                />
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(2)} data-testid="button-back-compliance">
              Back
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!isStepComplete(3) || applyMutation.isPending}
              data-testid="button-submit-application"
            >
              {applyMutation.isPending ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
