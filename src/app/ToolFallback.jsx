export default function ToolFallback({ name, message }) {
  return (
    <div className="container flex flex-col items-center justify-center py-20 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">{name}</h2>
      <p className="mt-3 text-muted-foreground">
        {message ?? 'Loading…'}
      </p>
    </div>
  );
}
