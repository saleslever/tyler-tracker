import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import Overview from "@/pages/Overview";
import Habits from "@/pages/Habits";
import Tasks from "@/pages/Tasks";
import Analytics from "@/pages/Analytics";
import JournalPage from "@/pages/Journal";
import MorningAlignment from "@/pages/MorningAlignment";
import Challenge from "@/pages/Challenge";
import Quests from "@/pages/Quests";
import Milestones from "@/pages/Milestones";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Overview} />
        <Route path="/habits" component={Habits} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/journal" component={JournalPage} />
        <Route path="/alignment" component={MorningAlignment} />
        <Route path="/goals" component={MorningAlignment} />
        <Route path="/challenge" component={Challenge} />
        <Route path="/quests" component={Quests} />
        <Route path="/milestones" component={Milestones} />
        <Route component={NotFound} />
      </Switch>
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
