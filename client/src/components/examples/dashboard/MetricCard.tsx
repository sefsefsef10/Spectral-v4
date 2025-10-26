import MetricCard from '../../dashboard/MetricCard';

export default function MetricCardExample() {
  return (
    <div className="p-8 space-y-4">
      <MetricCard value={23} label="AI Systems" />
      <MetricCard value={2} label="At Risk" variant="warning" />
      <MetricCard value="100%" label="Compliant" variant="success" />
    </div>
  );
}
