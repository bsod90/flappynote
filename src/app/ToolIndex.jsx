import { Link } from 'react-router-dom';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { tools } from '@/tools/registry';
import { cn } from '@/lib/utils';

export default function ToolIndex() {
  return (
    <div className="container py-10">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Music practice tools
        </h1>
        <p className="mt-3 text-muted-foreground">
          A small suite of free, browser-based tools to help you practice singing and
          musicianship. Pick a tool to get started.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const Inner = (
            <Card
              className={cn(
                'h-full transition-colors',
                tool.disabled
                  ? 'cursor-not-allowed opacity-60'
                  : 'hover:border-primary/40 hover:shadow-md'
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                      {Icon ? <Icon className="h-5 w-5" /> : null}
                    </div>
                    <CardTitle>{tool.name}</CardTitle>
                  </div>
                  {tool.disabled && <Badge variant="secondary">Soon</Badge>}
                </div>
                <CardDescription className="mt-3">
                  {tool.description ?? tool.tagline}
                </CardDescription>
              </CardHeader>
            </Card>
          );

          return tool.disabled ? (
            <div key={tool.id}>{Inner}</div>
          ) : (
            <Link
              key={tool.id}
              to={tool.path}
              className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {Inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
