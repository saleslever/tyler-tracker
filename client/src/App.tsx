import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import Habits from "@/pages/Habits";
import NotFound from "@/pages/not-found";

// Lazy-load heavy or infrequent routes to trim initial bundle
const Tasks = lazy(() => import("@/pages/Tasks"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const JournalPage = lazy(() => import("@/pages/Journal"));
const MoodPage = lazy(() => import("@/pages/Mood"));
const Fasting = lazy(() => import("@/pages/Fasting"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const Coach = lazy(() => import("@/pages/Coach"));
const Atlas = lazy(() => import("@/pages/Atlas"));
const GenerateWorkout = lazy(() => import("@/pages/GenerateWorkout"));
const Uploads = lazy(() => import("@/pages/Uploads"));

function PageFallback() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
      <div className="h-8 w-40 rounded bg-secondary/50 animate-pulse mb-4" />
      <div className="h-32 w-full rounded bg-secondary/40 animate-pulse" />
    </div>
  );
}

function AppRouter() {
  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/" component={Coach} />
          <Route path="/coach" component={Coach} />
          <Route path="/atlas" component={Atlas} />
          <Route path="/generate" component={GenerateWorkout} />
          <Route path="/uploads" component={Uploads} />
          <Route path="/habits" component={Habits} />
          <Route path="/tasks" component={Tasks} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/journal" component={JournalPage} />
          <Route path="/mood" component={MoodPage} />
          <Route path="/fasting" component={Fasting} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
