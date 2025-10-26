import SystemDetail from '../../dashboard/SystemDetail';

export default function SystemDetailExample() {
  return (
    <div className="p-8">
      <SystemDetail onBack={() => console.log('Back clicked')} />
    </div>
  );
}
