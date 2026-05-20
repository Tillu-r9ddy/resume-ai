/**
 * App — root component. Phase 2 onward, its only job is to mount the router.
 *
 * Why so thin?
 *   Everything user-facing (layout, nav, error/suspense boundaries) lives
 *   inside the router tree (see router.tsx → Shell). That keeps App.tsx a
 *   stable mount point and lets the rest of the app evolve without us
 *   touching the entry component.
 *
 * The Phase 1 placeholder welcome screen lived here too; it's been replaced
 * by routes/Home.tsx, which renders inside the Shell at "/".
 */
import { RouterProvider } from 'react-router';
import { router } from './router';

function App(): React.JSX.Element {
  return <RouterProvider router={router} />;
}

export default App;
