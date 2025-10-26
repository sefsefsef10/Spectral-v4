import ActivityItem from '../../dashboard/ActivityItem';

export default function ActivityItemExample() {
  return (
    <div className="p-8 max-w-2xl space-y-2">
      <ActivityItem description="Imaging vendor certified" timeAgo="3 days ago" />
      <ActivityItem description="Board report generated" timeAgo="1 week ago" />
      <ActivityItem description="PHI leakage test passed" timeAgo="2 weeks ago" />
    </div>
  );
}
