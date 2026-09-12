type EmptyStateProps = {
  title: string;
  body: string;
};

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="empty">
      <p className="t-head" style={{ color: "var(--label)" }}>
        {title}
      </p>
      <p className="t-foot" style={{ marginTop: 6 }}>
        {body}
      </p>
    </div>
  );
}
