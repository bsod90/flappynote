import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft, Music2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getToolByPath } from '@/tools/registry';
import AppFooter from './AppFooter.jsx';

export default function AppShell() {
  const location = useLocation();
  const activeTool = getToolByPath(location.pathname);
  const isIndex = location.pathname === '/';

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex h-14 items-center gap-3">
          {!isIndex && (
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link to="/" aria-label="Back to tools">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Tools</span>
              </Link>
            </Button>
          )}

          {/* On the index page, show the brand. On a tool page, the back
              button + the tool's own icon are enough — no brand mark. */}
          {isIndex ? (
            <NavLink to="/" className="flex items-center gap-2 font-semibold">
              <Music2 className="h-5 w-5 text-primary" />
              <span>Musical Playground</span>
            </NavLink>
          ) : (
            activeTool && (
              <span className="flex items-center gap-2 font-semibold">
                {activeTool.icon && (
                  <activeTool.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                )}
                {activeTool.name}
              </span>
            )
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </main>

      <AppFooter />
    </div>
  );
}
