import AlertItem from '../../dashboard/AlertItem';

export default function AlertItemExample() {
  return (
    <div className="p-8 max-w-2xl">
      <AlertItem
        title="Epic Ambient AI"
        description="Drift detected"
        onAction={() => console.log('View details')}
      />
      <AlertItem
        title="Radiology AI v2.1"
        description="Re-verification due"
        onAction={() => console.log('Schedule')}
      />
    </div>
  );
}
