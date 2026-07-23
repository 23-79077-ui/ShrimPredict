export default function StatCard({ title, value, tone = 'primary' }) {
  return (
    <div className={`card border-0 shadow-sm text-bg-${tone}`}>
      <div className="card-body">
        <h6 className="text-uppercase small">{title}</h6>
        <h3 className="fw-bold">{value}</h3>
      </div>
    </div>
  );
}
