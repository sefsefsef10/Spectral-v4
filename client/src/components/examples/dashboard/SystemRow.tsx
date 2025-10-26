import SystemRow from '../../dashboard/SystemRow';

export default function SystemRowExample() {
  return (
    <div className="p-8">
      <div className="border rounded-lg">
        <div className="grid grid-cols-5 gap-4 px-4 py-2 bg-muted text-sm font-medium border-b">
          <div>System Name</div>
          <div>Department</div>
          <div>Risk</div>
          <div>Status</div>
          <div>Last Check</div>
        </div>
        <SystemRow
          name="Epic Ambient AI"
          department="Clinical"
          riskLevel="Medium"
          status="verified"
          lastCheck="2 days"
          onClick={() => console.log('Clicked Epic')}
        />
        <SystemRow
          name="Radiology AI 2.1"
          department="Imaging"
          riskLevel="High"
          status="drift"
          lastCheck="4 hours"
          onClick={() => console.log('Clicked Radiology')}
        />
        <SystemRow
          name="Internal Chatbot"
          department="IT"
          riskLevel="Low"
          status="testing"
          lastCheck="ongoing"
          onClick={() => console.log('Clicked Chatbot')}
        />
      </div>
    </div>
  );
}
