import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';

import Home from '@/screens/home';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import '@/index.css';

const paths = [
    {
        path: '/',
        element: (
          <ErrorBoundary>
            <Home/>
          </ErrorBoundary>
        ),
    },
];

const BrowserRouter = createBrowserRouter(paths);

const App = () => {
    return (
    <ErrorBoundary>
      <MantineProvider>
        <RouterProvider router={BrowserRouter}/>
      </MantineProvider>
    </ErrorBoundary>
    )
};

export default App;
