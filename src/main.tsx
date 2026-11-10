import { StrictMode, lazy } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "@fontsource/nunito/900.css";
import "./index.css";
import App from "./App";
import { AuthProvider, RequireAuth } from "@/lib/auth";
import Home from "@/pages/Home";
import Events from "@/pages/Events";
import Register from "@/pages/Register";
import Ticket from "@/pages/Ticket";
import NotFound, { RouteError } from "@/pages/NotFound";

// Admin pages and the dev preview are split into their own chunks.
const AdminHome = lazy(() => import("@/pages/admin/AdminHome"));
const EventNew = lazy(() => import("@/pages/admin/EventNew"));
const EventDetail = lazy(() => import("@/pages/admin/EventDetail"));
const Scan = lazy(() => import("@/pages/admin/Scan"));
const DevReggie = lazy(() => import("@/pages/DevReggie"));

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        errorElement: <RouteError />,
        children: [
          { index: true, element: <Home /> },
          { path: "events", element: <Events /> },
          { path: "events/:eventId/register", element: <Register /> },
          { path: "ticket/:token", element: <Ticket /> },
          { path: "admin", element: <AdminHome /> },
          {
            path: "admin/events/new",
            element: (
              <RequireAuth>
                <EventNew />
              </RequireAuth>
            ),
          },
          {
            path: "admin/events/:eventId",
            element: (
              <RequireAuth>
                <EventDetail />
              </RequireAuth>
            ),
          },
          {
            path: "admin/events/:eventId/scan",
            element: (
              <RequireAuth>
                <Scan />
              </RequireAuth>
            ),
          },
          { path: "dev/reggie", element: <DevReggie /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
