import Sidebar from '../../dashboard/Sidebar';

export default function SidebarExample() {
  return (
    <div className="h-screen">
      <Sidebar currentView="dashboard" onViewChange={(view) => console.log('View changed:', view)} />
    </div>
  );
}
