import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Award, CheckCircle2, XCircle, FileText, ExternalLink, AlertCircle } from "lucide-react";
import type { CertificationApplication, Vendor } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CertificationReviewView() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedApp, setSelectedApp] = useState<CertificationApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: allVendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    enabled: !!user,
  });

  const { data: allApplications = [] } = useQuery<CertificationApplication[]>({
    queryKey: ["/api/certifications/applications", allVendors.map(v => v.id).join(',')],
    enabled: !!user && allVendors.length > 0,
    queryFn: async () => {
      const apps: CertificationApplication[] = [];
      for (const vendor of allVendors) {
        const vendorApps = await fetch(`/api/vendors/${vendor.id}/certifications/applications`, {
          credentials: "include",
        }).then(res => res.ok ? res.json() : []);
        apps.push(...vendorApps);
      }
      return apps;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (data: { applicationId: string; vendorId: string; status: string; rejectionReason?: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/vendors/${data.vendorId}/certifications/applications/${data.applicationId}/review`, {
        status: data.status,
        rejectionReason: data.rejectionReason,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      toast({
        title: "Review Submitted",
        description: `Application ${reviewAction === "approve" ? "approved" : "rejected"} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/certifications/applications"] });
      setSelectedApp(null);
      setReviewAction(null);
      setRejectionReason("");
      setReviewNotes("");
    },
    onError: () => {
      toast({
        title: "Review Failed",
        description: "Failed to submit review. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleReview = () => {
    if (!selectedApp || !reviewAction) return;

    if (reviewAction === "reject" && !rejectionReason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }

    reviewMutation.mutate({
      applicationId: selectedApp.id,
      vendorId: selectedApp.vendorId,
      status: reviewAction === "approve" ? "approved" : "rejected",
      rejectionReason: reviewAction === "reject" ? rejectionReason : undefined,
      notes: reviewNotes || undefined,
    });
  };

  const getVendorName = (vendorId: string) => {
    const vendor = allVendors.find(v => v.id === vendorId);
    return vendor?.name || "Unknown Vendor";
  };

  const pendingApplications = allApplications.filter(app => app.status === "in_review" || app.status === "pending");
  const reviewedApplications = allApplications.filter(app => app.status === "approved" || app.status === "rejected");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Certification Review Queue</h1>
        <p className="text-muted-foreground">
          Review and approve vendor certification applications
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-3xl font-bold" data-testid="metric-pending">
              {pendingApplications.length}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">Pending Review</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold" data-testid="metric-approved">
              {allApplications.filter(a => a.status === "approved").length}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">Approved</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="text-3xl font-bold" data-testid="metric-rejected">
              {allApplications.filter(a => a.status === "rejected").length}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">Rejected</div>
        </Card>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Pending Applications</h2>
          {pendingApplications.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
              <p className="text-muted-foreground">
                No pending certification applications to review
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingApplications.map((app) => {
                const automatedResult = app.automatedChecksResult ? JSON.parse(app.automatedChecksResult) : null;
                return (
                  <Card key={app.id} className="p-4" data-testid={`application-${app.id}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`w-12 h-12 ${
                          app.tierRequested === "Platinum" ? "bg-purple-100" :
                          app.tierRequested === "Gold" ? "bg-yellow-100" : "bg-gray-100"
                        } rounded-lg flex items-center justify-center`}>
                          <Award className={`w-6 h-6 ${
                            app.tierRequested === "Platinum" ? "text-purple-600" :
                            app.tierRequested === "Gold" ? "text-yellow-600" : "text-gray-600"
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{getVendorName(app.vendorId)}</h4>
                            <Badge variant="secondary">{app.tierRequested}</Badge>
                            <Badge variant={app.status === "in_review" ? "default" : "outline"}>
                              {app.status === "in_review" ? "Ready for Review" : "Pending Tests"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Submitted {new Date(app.submittedAt || app.createdAt || "").toLocaleDateString()}
                          </p>
                          
                          {automatedResult && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className={`text-sm font-medium ${
                                  automatedResult.passed ? "text-green-600" : "text-red-600"
                                }`}>
                                  Automated Score: {automatedResult.score}/100
                                </div>
                                {automatedResult.passed ? (
                                  <Badge variant="outline" className="text-green-600 border-green-600">
                                    ✓ Tests Passed
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-red-600 border-red-600">
                                    ✗ Tests Failed
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-3 gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Documentation:</span>
                                  <span className={`ml-2 ${automatedResult.checks.documentation ? "text-green-600" : "text-red-600"}`}>
                                    {automatedResult.checks.documentation ? "✓ Pass" : "✗ Fail"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Compliance:</span>
                                  <span className={`ml-2 ${automatedResult.checks.compliance ? "text-green-600" : "text-red-600"}`}>
                                    {automatedResult.checks.compliance ? "✓ Pass" : "✗ Fail"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Deployments:</span>
                                  <span className={`ml-2 ${automatedResult.checks.deployments ? "text-green-600" : "text-red-600"}`}>
                                    {automatedResult.checks.deployments ? "✓ Pass" : "✗ Fail"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button onClick={() => setSelectedApp(app)} data-testid={`button-review-${app.id}`}>
                        Review Application
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {reviewedApplications.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Recently Reviewed</h2>
            <div className="space-y-3">
              {reviewedApplications.slice(0, 5).map((app) => (
                <Card key={app.id} className="p-4">
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
                          <h4 className="font-semibold">{getVendorName(app.vendorId)}</h4>
                          <Badge variant="secondary">{app.tierRequested}</Badge>
                          <Badge variant={app.status === "approved" ? "default" : "destructive"}>
                            {app.status === "approved" ? "Approved" : "Rejected"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Reviewed {new Date(app.reviewedAt || "").toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  {app.rejectionReason && (
                    <div className="mt-3 p-3 bg-destructive/10 rounded-md">
                      <p className="text-sm text-destructive font-medium">Rejection Reason:</p>
                      <p className="text-sm text-muted-foreground">{app.rejectionReason}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!selectedApp} onOpenChange={(open) => !open && setSelectedApp(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review Certification Application</DialogTitle>
            <DialogDescription>
              {selectedApp && getVendorName(selectedApp.vendorId)} - {selectedApp?.tierRequested} Certification
            </DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Automated Test Results</h4>
                {selectedApp.automatedChecksResult ? (
                  <div className="p-4 bg-muted rounded-lg space-y-3">
                    {(() => {
                      const result = JSON.parse(selectedApp.automatedChecksResult);
                      return (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Overall Score: {result.score}/100</span>
                            {result.passed ? (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                ✓ Tests Passed
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-red-600 border-red-600">
                                ✗ Tests Failed
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-2 text-sm">
                            {result.recommendations.map((rec: string, i: number) => (
                              <div key={i} className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                                <span>{rec}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Automated testing in progress...</p>
                )}
              </div>

              <div>
                <h4 className="font-medium mb-2">Documentation URLs</h4>
                <div className="space-y-2">
                  {selectedApp.documentationUrls?.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover-elevate p-2 rounded"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {url}
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Compliance Statements</h4>
                {selectedApp.complianceStatements ? (
                  <div className="space-y-2 text-sm">
                    {(() => {
                      const statements = JSON.parse(selectedApp.complianceStatements);
                      return (
                        <>
                          {statements.hipaa && (
                            <div className="p-3 bg-muted rounded">
                              <p className="font-medium mb-1">HIPAA:</p>
                              <p className="text-muted-foreground">{statements.hipaa}</p>
                            </div>
                          )}
                          {statements.nist && (
                            <div className="p-3 bg-muted rounded">
                              <p className="font-medium mb-1">NIST AI RMF:</p>
                              <p className="text-muted-foreground">{statements.nist}</p>
                            </div>
                          )}
                          {statements.fda && (
                            <div className="p-3 bg-muted rounded">
                              <p className="font-medium mb-1">FDA SaMD / ISO 13485:</p>
                              <p className="text-muted-foreground">{statements.fda}</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No compliance statements provided</p>
                )}
              </div>

              {reviewAction && (
                <div className="space-y-4 pt-4 border-t">
                  {reviewAction === "reject" && (
                    <div className="space-y-2">
                      <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                      <Textarea
                        id="rejection-reason"
                        placeholder="Explain why this application is being rejected..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={3}
                        data-testid="textarea-rejection-reason"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="review-notes">Review Notes (Optional)</Label>
                    <Textarea
                      id="review-notes"
                      placeholder="Additional notes or feedback..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={3}
                      data-testid="textarea-review-notes"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!reviewAction ? (
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedApp(null)}
                  data-testid="button-close-dialog"
                >
                  Close
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setReviewAction("reject")}
                  data-testid="button-reject-start"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setReviewAction("approve")}
                  data-testid="button-approve-start"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReviewAction(null);
                    setRejectionReason("");
                    setReviewNotes("");
                  }}
                  data-testid="button-cancel-review"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReview}
                  disabled={reviewMutation.isPending || (reviewAction === "reject" && !rejectionReason.trim())}
                  data-testid="button-confirm-review"
                >
                  {reviewMutation.isPending ? "Submitting..." : `Confirm ${reviewAction === "approve" ? "Approval" : "Rejection"}`}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
