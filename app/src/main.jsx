import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import { AuthProvider } from "./lib/AuthContext";
import AppErrorBoundary from "./components/AppErrorBoundary";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <App />
          <Toaster position="top-center" richColors theme="dark" />
        </BrowserRouter>
      </AuthProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
