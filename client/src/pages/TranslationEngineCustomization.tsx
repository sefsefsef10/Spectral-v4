import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Shield, AlertTriangle, CheckCircle2, Clock, X } from 'lucide-react';

export default function TranslationEngineCustomization() {
  const [activeTab, setActiveTab] = useState('thresholds');
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [showCustomControlDialog, setShowCustomControlDialog] = useState(false);
  const queryClient = useQueryClient();

  // Fetch user plan tier to determine customization access
  const { data: userProfile } = useQuery<any>({
    queryKey: ['/api/auth/me'],
  });

  const isEnterpriseTier = userProfile?.organization?.planTier === 'enterprise';

  // Fetch existing customizations
  const { data: customizations } = useQuery<any>({
    queryKey: ['/api/customizations'],
    enabled: isEnterpriseTier,
  });

  const { data: pendingApprovals } = useQuery<any[]>({
    queryKey: ['/api/customizations/pending'],
    enabled: userProfile?.role === 'super_admin',
  });

  // Mutation for threshold override request
  const overrideThresholdMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/customizations/threshold-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to submit override request');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customizations'] });
      toast({
        title: 'Override Request Submitted',
        description: 'Your threshold override request has been submitted for approval.',
      });
      setShowOverrideDialog(false);
    },
  });

  // Mutation for custom control request
  const customControlMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/customizations/custom-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to submit custom control request');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customizations'] });
      toast({
        title: 'Custom Control Request Submitted',
        description: 'Your custom control request has been submitted for approval.',
      });
      setShowCustomControlDialog(false);
    },
  });

  // Mutation for approving/rejecting customizations (admin only)
  const reviewCustomizationMutation = useMutation({
    mutationFn: async ({ id, action, notes }: { id: string; action: 'approve' | 'reject'; notes: string }) => {
      const response = await fetch(`/api/customizations/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Failed to ${action} customization`);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/customizations/pending'] });
      toast({
        title: variables.action === 'approve' ? 'Request Approved' : 'Request Rejected',
        description: `Customization request has been ${variables.action}d.`,
      });
    },
  });

  if (!isEnterpriseTier && userProfile?.role !== 'super_admin') {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Translation Engine Customization</CardTitle>
            <CardDescription>Enterprise-only feature</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Translation Engine customization is available exclusively for Enterprise tier customers.
                Upgrade your plan to unlock threshold tuning, control toggles, and custom compliance controls.
              </AlertDescription>
            </Alert>
            <Button className="mt-4" onClick={() => window.location.href = '/pricing'}>
              Upgrade to Enterprise
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Translation Engine Customization</h1>
        <p className="text-muted-foreground mt-2">
          Customize compliance thresholds, control toggles, and create custom controls for your organization.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="thresholds">Threshold Overrides</TabsTrigger>
          <TabsTrigger value="controls">Control Toggles</TabsTrigger>
          <TabsTrigger value="custom">Custom Controls</TabsTrigger>
          {userProfile?.role === 'super_admin' && (
            <TabsTrigger value="approvals">
              Pending Approvals
              {pendingApprovals && pendingApprovals.length > 0 && (
                <Badge variant="destructive" className="ml-2">{pendingApprovals.length}</Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        {/* Threshold Overrides Tab */}
        <TabsContent value="thresholds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Threshold Overrides</CardTitle>
              <CardDescription>
                Adjust compliance detection thresholds for specific event types. All changes require approval.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowOverrideDialog(true)}>
                Request Threshold Override
              </Button>

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Active Overrides</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Default Threshold</TableHead>
                      <TableHead>Custom Threshold</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Approved By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customizations?.thresholdOverrides?.map((override: any) => (
                      <TableRow key={override.id}>
                        <TableCell className="font-medium">{override.eventType}</TableCell>
                        <TableCell>{override.defaultThreshold}</TableCell>
                        <TableCell>{override.customThreshold}</TableCell>
                        <TableCell>
                          <Badge variant={override.status === 'approved' ? 'default' : 'secondary'}>
                            {override.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{override.approvedBy || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Control Toggles Tab */}
        <TabsContent value="controls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Control Toggles</CardTitle>
              <CardDescription>
                Enable or disable specific compliance controls. HIPAA controls cannot be disabled (regulatory guardrail).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { id: 'phi_exposure', name: 'PHI Exposure Detection', framework: 'HIPAA', canDisable: false },
                  { id: 'model_drift', name: 'Model Drift Detection', framework: 'NIST AI RMF', canDisable: true },
                  { id: 'bias_detection', name: 'Bias Detection', framework: 'NIST AI RMF', canDisable: true },
                  { id: 'data_quality', name: 'Data Quality Checks', framework: 'Internal', canDisable: true },
                ].map((control) => (
                  <div key={control.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{control.name}</div>
                      <div className="text-sm text-muted-foreground">{control.framework}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      {!control.canDisable && (
                        <Badge variant="outline" className="text-orange-600">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Cannot be disabled
                        </Badge>
                      )}
                      <input
                        type="checkbox"
                        defaultChecked
                        disabled={!control.canDisable}
                        className="h-5 w-5"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Controls Tab */}
        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom Compliance Controls</CardTitle>
              <CardDescription>
                Request custom compliance controls tailored to your organization's specific policies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowCustomControlDialog(true)}>
                Request Custom Control
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approvals Tab (Admin Only) */}
        {userProfile?.role === 'super_admin' && (
          <TabsContent value="approvals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Approval Requests</CardTitle>
                <CardDescription>
                  Review and approve or reject customization requests from Enterprise customers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pendingApprovals && pendingApprovals.map((request: any) => (
                    <CustomizationApprovalCard
                      key={request.id}
                      request={request}
                      onReview={(id, action, notes) => reviewCustomizationMutation.mutate({ id, action, notes })}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Audit Trail Tab */}
        <TabsContent value="audit" data-testid="audit-trail" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customization Audit Trail</CardTitle>
              <CardDescription>
                Complete history of all customization requests, approvals, and rejections.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reviewer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customizations?.auditTrail?.map((entry: any) => (
                    <TableRow key={entry.id} data-testid="audit-entry">
                      <TableCell data-field="timestamp">{new Date(entry.timestamp).toLocaleString()}</TableCell>
                      <TableCell data-field="action">{entry.action}</TableCell>
                      <TableCell data-field="user">{entry.user}</TableCell>
                      <TableCell data-field="status">
                        <Badge>{entry.status}</Badge>
                      </TableCell>
                      <TableCell>{entry.reviewer || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Threshold Override Dialog */}
      <ThresholdOverrideDialog
        open={showOverrideDialog}
        onClose={() => setShowOverrideDialog(false)}
        onSubmit={(data) => overrideThresholdMutation.mutate(data)}
      />

      {/* Custom Control Dialog */}
      <CustomControlDialog
        open={showCustomControlDialog}
        onClose={() => setShowCustomControlDialog(false)}
        onSubmit={(data) => customControlMutation.mutate(data)}
      />
    </div>
  );
}

// Threshold Override Dialog Component
function ThresholdOverrideDialog({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    eventType: '',
    newThreshold: '',
    justification: '',
    evidenceUrl: '',
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Request Threshold Override</DialogTitle>
          <DialogDescription>
            Submit a request to adjust the detection threshold for a specific event type.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Event Type</Label>
            <Select value={formData.eventType} onValueChange={(v) => setFormData({ ...formData, eventType: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="model_drift">Model Drift</SelectItem>
                <SelectItem value="bias_detected">Bias Detection</SelectItem>
                <SelectItem value="high_latency">High Latency</SelectItem>
                <SelectItem value="clinical_inaccuracy">Clinical Inaccuracy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>New Threshold Value</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.newThreshold}
              onChange={(e) => setFormData({ ...formData, newThreshold: e.target.value })}
              placeholder="e.g., 0.15"
            />
          </div>
          <div>
            <Label>Clinical Justification</Label>
            <Textarea
              value={formData.justification}
              onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
              placeholder="Provide clinical evidence supporting this threshold adjustment..."
              rows={4}
            />
          </div>
          <div>
            <Label>Evidence URL (Optional)</Label>
            <Input
              value={formData.evidenceUrl}
              onChange={(e) => setFormData({ ...formData, evidenceUrl: e.target.value })}
              placeholder="https://clinicaltrials.gov/study/NCT12345"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit(formData)}>Submit for Approval</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Custom Control Dialog Component
function CustomControlDialog({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    controlName: '',
    description: '',
    triggerEventType: '',
    severity: '',
    justification: '',
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Request Custom Control</DialogTitle>
          <DialogDescription>
            Create a custom compliance control specific to your organization's policies.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Control Name</Label>
            <Input
              value={formData.controlName}
              onChange={(e) => setFormData({ ...formData, controlName: e.target.value })}
              placeholder="e.g., Institutional Ethics Board Review"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this control monitors and enforces..."
              rows={3}
            />
          </div>
          <div>
            <Label>Trigger Event Type</Label>
            <Select value={formData.triggerEventType} onValueChange={(v) => setFormData({ ...formData, triggerEventType: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select trigger event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deployment_unauthorized">Deployment</SelectItem>
                <SelectItem value="clinical_inaccuracy">Clinical Inaccuracy</SelectItem>
                <SelectItem value="bias_detected">Bias Detected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Severity</Label>
            <Select value={formData.severity} onValueChange={(v) => setFormData({ ...formData, severity: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Business Justification</Label>
            <Textarea
              value={formData.justification}
              onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
              placeholder="Explain why this custom control is necessary for your organization..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit(formData)}>Submit Custom Control Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Approval Card Component (Admin View)
function CustomizationApprovalCard({ request, onReview }: { request: any; onReview: (id: string, action: 'approve' | 'reject', notes: string) => void }) {
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{request.type === 'threshold' ? 'Threshold Override' : 'Custom Control'}</CardTitle>
              <CardDescription>
                Requested by {request.requesterName} on {new Date(request.createdAt).toLocaleDateString()}
              </CardDescription>
            </div>
            <Badge>
              <Clock className="h-3 w-3 mr-1" />
              Pending
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            {request.type === 'threshold' ? (
              <>
                <div>
                  <dt className="font-medium">Event Type</dt>
                  <dd className="text-muted-foreground">{request.eventType}</dd>
                </div>
                <div>
                  <dt className="font-medium">New Threshold</dt>
                  <dd className="text-muted-foreground">{request.newThreshold}</dd>
                </div>
              </>
            ) : (
              <>
                <div>
                  <dt className="font-medium">Control Name</dt>
                  <dd className="text-muted-foreground">{request.controlName}</dd>
                </div>
                <div>
                  <dt className="font-medium">Severity</dt>
                  <dd className="text-muted-foreground">{request.severity}</dd>
                </div>
              </>
            )}
          </dl>
          <div className="mt-4">
            <dt className="font-medium mb-1">Justification</dt>
            <dd className="text-muted-foreground">{request.justification}</dd>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              variant="default"
              onClick={() => {
                setReviewAction('approve');
                setShowReviewDialog(true);
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setReviewAction('reject');
                setShowReviewDialog(true);
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewAction === 'approve' ? 'Approve' : 'Reject'} Request</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Review Notes</Label>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder={reviewAction === 'approve' ? 'Clinical evidence supports this request...' : 'Insufficient evidence. Please provide peer-reviewed studies...'}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                onReview(request.id, reviewAction, reviewNotes);
                setShowReviewDialog(false);
              }}
            >
              Confirm {reviewAction === 'approve' ? 'Approval' : 'Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
