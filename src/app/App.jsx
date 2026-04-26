import { Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';

import { TooltipProvider } from '@/components/ui/tooltip';
import { tools } from '@/tools/registry';
import { trackPageView } from '@/lib/analytics';
import AppShell from './AppShell.jsx';
import ToolIndex from './ToolIndex.jsx';
import NotFound from './NotFound.jsx';
import ToolFallback from './ToolFallback.jsx';
import { useColorScheme } from './useColorScheme.js';

export default function App() {
  useColorScheme();

  return (
    <TooltipProvider>
      <BrowserRouter>
        <RouteAnalytics />
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<ToolIndex />} />
            {tools.map((tool) => (
              <Route
                key={tool.id}
                path={tool.path}
                element={
                  tool.Component ? (
                    <Suspense fallback={<ToolFallback name={tool.name} />}>
                      <tool.Component />
                    </Suspense>
                  ) : (
                    <ToolFallback name={tool.name} message="This tool is coming soon." />
                  )
                }
              />
            ))}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
}

function RouteAnalytics() {
  const { pathname } = useLocation();
  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);
  return null;
}
