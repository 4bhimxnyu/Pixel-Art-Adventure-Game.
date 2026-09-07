import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter, createRootRoute, createRoute } from "@tanstack/react-router";
import { RootShell } from "./routes/__root";
import { IndexPage } from "./routes/index";
import "./styles.css";

const rootRoute = createRootRoute({ component: RootShell });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: IndexPage });
const routeTree = rootRoute.addChildren([indexRoute]);

const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
