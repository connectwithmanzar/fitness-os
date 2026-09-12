type EmptyStateProps = {
  title: string;
  body: string;
};

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="rounded-card border border-dashed border-line px-4 py-10 text-center">
      <span className="os-dot" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm leading-6 text-mute">{body}</p>
    </div>
  );
}
