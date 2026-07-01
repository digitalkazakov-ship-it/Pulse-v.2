import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ShareLayout } from "@/components/ShareLayout";
import Overview from "@/pages/Overview";
import BrandAwareness from "@/pages/BrandAwareness";
import Perception from "@/pages/Perception";
import DigitalAudit from "@/pages/DigitalAudit";
import Availability from "@/pages/Availability";
import Sales from "@/pages/Sales";
import MediaCreatives from "@/pages/MediaCreatives";
import MediaDetails from "@/pages/MediaDetails";
import StrategyInsights from "@/pages/StrategyInsights";
import Conversations from "@/pages/Conversations";
import Projects from "@/pages/Projects";
import Upload from "@/pages/Upload";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Share (public read-only) routes — outside ProjectProvider */}
          <Route path="/share/:token" element={<ShareLayout />}>
            <Route index element={<Overview />} />
            <Route path="awareness" element={<BrandAwareness />} />
            <Route path="perception" element={<Perception />} />
            <Route path="digital" element={<DigitalAudit />} />
            <Route path="availability" element={<Availability />} />
            <Route path="sales" element={<Sales />} />
            <Route path="media" element={<MediaCreatives />} />
            <Route path="media-details" element={<MediaDetails />} />
            <Route path="insights" element={<StrategyInsights />} />
            <Route path="conversations" element={<Conversations />} />
          </Route>

          {/* Main app routes */}
          <Route path="/*" element={
            <ProjectProvider>
              <DashboardLayout>
                <Routes>
                  <Route path="/" element={<Overview />} />
                  <Route path="/awareness" element={<BrandAwareness />} />
                  <Route path="/perception" element={<Perception />} />
                  <Route path="/digital" element={<DigitalAudit />} />
                  <Route path="/availability" element={<Availability />} />
                  <Route path="/sales" element={<Sales />} />
                  <Route path="/media" element={<MediaCreatives />} />
                  <Route path="/media-details" element={<MediaDetails />} />
                  <Route path="/insights" element={<StrategyInsights />} />
                  <Route path="/conversations" element={<Conversations />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/upload" element={<Upload />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </DashboardLayout>
            </ProjectProvider>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
