import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { FileText, Copy, Download, Share2 } from "lucide-react";

interface ProcurementTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  template: string;
}

const PROCUREMENT_TEMPLATES: ProcurementTemplate[] = [
  {
    id: "rfp-ai-vendor",
    name: "RFP - AI Vendor Selection",
    category: "RFP",
    description: "Require Spectral certification for AI vendor procurement",
    template: `COMPLIANCE REQUIREMENT - AI GOVERNANCE

All vendors responding to this RFP must demonstrate compliance with healthcare AI governance standards through one of the following:

1. Spectral Trusted Tier Certification (preferred)
2. Spectral Certified Tier with documented HIPAA compliance
3. Equivalent third-party certification with evidence of:
   - PHI protection and automated redaction capabilities
   - Clinical accuracy validation (>95% on standard datasets)
   - Bias testing across protected demographic groups
   - Security threat modeling (STRIDE/LINDDUN)
   - Real-time compliance monitoring integration

EVALUATION CRITERIA:
- Spectral Trusted vendors: +20 points
- Spectral Certified vendors: +15 points
- Spectral Verified vendors: +10 points
- Non-certified vendors: Must provide equivalent documentation (subject to 4-week review)

INTEGRATION REQUIREMENT:
Selected vendor must integrate with {HEALTH_SYSTEM_NAME}'s Spectral AI Governance Platform within 30 days of contract execution for real-time compliance monitoring.

AUDIT RIGHTS:
{HEALTH_SYSTEM_NAME} reserves the right to conduct quarterly compliance audits through Spectral's automated certification framework.`,
  },
  {
    id: "contract-clause",
    name: "Contract Clause - AI Compliance",
    category: "Contract",
    description: "Add Spectral monitoring requirement to vendor contracts",
    template: `ARTICLE X - AI GOVERNANCE AND COMPLIANCE MONITORING

X.1 CERTIFICATION REQUIREMENT
Vendor shall maintain active Spectral certification (Certified Tier or higher) throughout the term of this Agreement. Vendor must notify {HEALTH_SYSTEM_NAME} within 5 business days of any certification status changes, violations, or compliance incidents.

X.2 REAL-TIME MONITORING
Vendor shall integrate with {HEALTH_SYSTEM_NAME}'s Spectral AI Governance Platform and transmit compliance telemetry data in real-time, including but not limited to:
  a) PHI access logs and automated redaction events
  b) Model prediction accuracy and bias metrics
  c) Security incidents and threat indicators
  d) Regulatory compliance status (HIPAA, NIST AI RMF, FDA SaMD)

X.3 COMPLIANCE VIOLATIONS
If Spectral's automated monitoring detects critical compliance violations (HIPAA breach, >10% bias differential, clinical safety incidents), Vendor shall:
  a) Provide root cause analysis within 24 hours
  b) Implement corrective action plan within 5 business days
  c) Submit to re-certification testing at Vendor's expense

X.4 TERMINATION FOR NON-COMPLIANCE
{HEALTH_SYSTEM_NAME} may immediately terminate this Agreement if:
  a) Vendor's Spectral certification is revoked or suspended
  b) Vendor fails to remediate critical violations within specified timeframes
  c) Vendor refuses integration with Spectral monitoring platform

X.5 INDEMNIFICATION
Vendor shall indemnify {HEALTH_SYSTEM_NAME} for all losses arising from AI compliance failures, including regulatory fines, patient harm, and reputational damage.`,
  },
  {
    id: "policy-standard",
    name: "Policy - AI Procurement Standard",
    category: "Policy",
    description: "Internal policy requiring Spectral for all AI vendors",
    template: `{HEALTH_SYSTEM_NAME} AI VENDOR PROCUREMENT POLICY

POLICY STATEMENT:
All artificial intelligence systems deployed within {HEALTH_SYSTEM_NAME} must comply with the Spectral Standard for Healthcare AI Governance.

SCOPE:
This policy applies to all AI/ML systems that:
- Process protected health information (PHI)
- Make clinical decisions or recommendations
- Interface with electronic health record (EHR) systems
- Analyze medical imaging or diagnostic data
- Automate administrative healthcare workflows

REQUIREMENTS:

1. PRE-PROCUREMENT EVALUATION
   Before issuing RFPs or contracts, procurement teams must:
   a) Verify vendor's Spectral certification status (Verified/Certified/Trusted)
   b) Review vendor's compliance history via Spectral Trust Page
   c) Confirm vendor accepts Spectral Standard monitoring requirements

2. VENDOR CERTIFICATION TIERS
   - Tier 3 (Trusted): Pre-approved for deployment, expedited procurement
   - Tier 2 (Certified): Standard procurement process, requires IT security review
   - Tier 1 (Verified): Extended evaluation, requires CISO approval
   - Non-certified: Requires full due diligence (8-12 weeks), executive approval

3. CONTRACT REQUIREMENTS
   All AI vendor contracts must include:
   a) Spectral certification maintenance clause
   b) Real-time monitoring integration requirement
   c) Compliance violation remediation procedures
   d) Termination rights for certification revocation

4. POST-DEPLOYMENT MONITORING
   IT Security team shall:
   a) Monitor all AI systems via Spectral governance platform
   b) Review compliance alerts within 24 hours
   c) Escalate critical violations to CISO immediately
   d) Conduct quarterly certification audits

5. EXCEPTIONS
   Exceptions require written approval from:
   - Chief Information Security Officer (CISO)
   - Chief Medical Officer (CMO) [for clinical AI]
   - Privacy Officer [for PHI processing]

COMPLIANCE:
Non-compliance with this policy may result in:
- Contract termination with non-certified vendors
- System access restrictions or shutdowns
- Disciplinary action for procurement staff
- Regulatory reporting (HIPAA breach, FDA adverse events)

EFFECTIVE DATE: {DATE}
REVIEW CYCLE: Annual
POLICY OWNER: Chief Information Security Officer`,
  },
  {
    id: "board-resolution",
    name: "Board Resolution - AI Governance",
    category: "Governance",
    description: "Board resolution adopting Spectral Standard",
    template: `BOARD OF DIRECTORS RESOLUTION
{HEALTH_SYSTEM_NAME}

RESOLUTION ADOPTING SPECTRAL STANDARD FOR AI GOVERNANCE

WHEREAS, {HEALTH_SYSTEM_NAME} is committed to patient safety and regulatory compliance in the deployment of artificial intelligence technologies; and

WHEREAS, the proliferation of AI systems in healthcare poses significant risks including HIPAA violations, clinical safety incidents, and algorithmic bias; and

WHEREAS, Spectral provides industry-leading AI governance, monitoring, and certification infrastructure specifically designed for healthcare organizations; and

WHEREAS, adoption of the Spectral Standard creates procurement efficiencies, reduces compliance risks, and demonstrates due diligence to regulators and patients;

NOW, THEREFORE, BE IT RESOLVED that the Board of Directors of {HEALTH_SYSTEM_NAME} hereby:

1. ADOPTS the Spectral Standard as the organization's framework for AI governance, requiring all AI vendors to maintain Spectral certification;

2. AUTHORIZES the Chief Information Security Officer to implement Spectral's AI governance platform across all health system facilities;

3. DIRECTS the Procurement Department to prioritize Spectral-certified vendors in all AI-related RFPs and contracts;

4. MANDATES quarterly reporting to the Board on AI compliance metrics, vendor performance, and risk mitigation through the Spectral platform;

5. ALLOCATES appropriate resources for Spectral platform subscription, staff training, and vendor compliance integration;

6. ESTABLISHES AI Governance Committee (reporting to Board) to oversee Spectral Standard implementation and policy compliance.

ADOPTED this {DAY} day of {MONTH}, {YEAR}.

_____________________________
Board Chair

_____________________________
Chief Executive Officer

_____________________________
Chief Information Security Officer`,
  },
];

export default function ProcurementLanguageGenerator() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<ProcurementTemplate | null>(null);
  const [customizedText, setCustomizedText] = useState<string>("");
  const [includeSpectral, setIncludeSpectral] = useState(true);

  const categories = ["all", ...Array.from(new Set(PROCUREMENT_TEMPLATES.map(t => t.category)))];
  const filteredTemplates = selectedCategory === "all" 
    ? PROCUREMENT_TEMPLATES 
    : PROCUREMENT_TEMPLATES.filter(t => t.category === selectedCategory);

  const handleSelectTemplate = (templateId: string) => {
    const template = PROCUREMENT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setCustomizedText(template.template);
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(customizedText);
  };

  const handleDownload = () => {
    const blob = new Blob([customizedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate?.id || 'procurement'}-language.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Procurement Language Generator</h2>
        <p className="text-muted-foreground">
          Generate pre-approved language to require Spectral certification in RFPs, contracts, and policies.
          Drives vendor adoption and creates network effects.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="text-2xl font-bold text-blue-700">4</div>
          <div className="text-sm text-muted-foreground">Template Categories</div>
        </Card>
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="text-2xl font-bold text-green-700">12</div>
          <div className="text-sm text-muted-foreground">Health Systems Using</div>
        </Card>
        <Card className="p-4 bg-purple-50 border-purple-200">
          <div className="text-2xl font-bold text-purple-700">180+</div>
          <div className="text-sm text-muted-foreground">Vendors Certified</div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Select Template</CardTitle>
            <CardDescription>Choose procurement language type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat === "all" ? "All Categories" : cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Templates</Label>
              {filteredTemplates.map(template => (
                <div
                  key={template.id}
                  onClick={() => handleSelectTemplate(template.id)}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedTemplate?.id === template.id 
                      ? "bg-primary/10 border-primary" 
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {template.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {template.description}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Checkbox 
                id="include-spectral" 
                checked={includeSpectral}
                onCheckedChange={(checked) => setIncludeSpectral(checked as boolean)}
              />
              <Label htmlFor="include-spectral" className="text-sm cursor-pointer">
                Include Spectral Standard requirement (drives vendor certification)
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customizable Language</CardTitle>
            <CardDescription>
              Edit and customize for your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTemplate ? (
              <>
                <Textarea
                  value={customizedText}
                  onChange={(e) => setCustomizedText(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder="Select a template to customize..."
                />
                <div className="flex gap-2">
                  <Button onClick={handleCopyToClipboard} variant="outline" className="flex-1">
                    <Copy className="w-4 h-4 mr-2" />
                    Copy to Clipboard
                  </Button>
                  <Button onClick={handleDownload} variant="outline" className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="outline">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-medium text-blue-900 mb-2">
                    🚀 Network Effect Impact
                  </div>
                  <div className="text-xs text-blue-700">
                    When you require Spectral certification in your procurement, vendors are incentivized 
                    to get certified. This increases the certified vendor pool, making Spectral more 
                    valuable to other health systems (creating a virtuous cycle).
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <div>Select a template to get started</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
