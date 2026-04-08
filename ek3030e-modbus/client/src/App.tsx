import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { GatewayProvider } from "./contexts/GatewayContext";
import Home from "./pages/Home";
import SettingsWrite from "./pages/SettingsWrite";
import GatewayConfigPage from "./pages/GatewayConfig";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/settings" component={SettingsWrite} />
        <Route path="/gateway" component={GatewayConfigPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <GatewayProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </GatewayProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
