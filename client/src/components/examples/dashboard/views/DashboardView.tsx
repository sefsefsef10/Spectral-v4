import DashboardView from '../../../dashboard/views/DashboardView';

export default function DashboardViewExample() {
  return (
    <div className="p-8">
      <DashboardView
        onNavigateToSystem={(system) => console.log('Navigate to:', system)}
        onNavigateToInventory={() => console.log('Navigate to inventory')}
      />
    </div>
  );
}
