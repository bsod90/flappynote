import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container flex flex-col items-center justify-center py-20 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-muted-foreground">
        We couldn't find the page you were looking for.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Back to tools</Link>
      </Button>
    </div>
  );
}
