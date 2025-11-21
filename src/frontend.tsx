/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { rootRoute } from "./App";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { kvRoute } from "./views/kv";
import { dashboardRoute } from "./views/dashboard";
import { d1Route } from "./views/d1";
import { durableObjectsRoute } from "./views/durable-objects";
import { requestsRoute } from "./views/requests";

const routeTree = rootRoute.addChildren([dashboardRoute, kvRoute, d1Route, durableObjectsRoute, requestsRoute])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

const elem = document.getElementById("root")!;
const app = (
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>
);

if (import.meta.hot) {
    // With hot module reloading, `import.meta.hot.data` is persisted.
    const root = (import.meta.hot.data.root ??= createRoot(elem));
    root.render(app);
} else {
    // The hot module reloading API is not available in production.
    createRoot(elem).render(app);
}
