import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ArchiveProjectProvider } from '@/contexts/ProjectContext';
import { setArchiveSource } from '@/lib/api';
import { ArchiveLayout } from './ArchiveLayout';
import { ARCHIVE_DATA } from './archive-data';
import BrandAwareness from '@/pages/BrandAwareness';
import Perception from '@/pages/Perception';
import DigitalAudit from '@/pages/DigitalAudit';
import Availability from '@/pages/Availability';
import Sales from '@/pages/Sales';
import MediaCreatives from '@/pages/MediaCreatives';
import MediaDetails from '@/pages/MediaDetails';
import StrategyInsights from '@/pages/StrategyInsights';

setArchiveSource({ data: ARCHIVE_DATA.data, insights: ARCHIVE_DATA.insights });

export function ArchiveApp() {
  return (
    <TooltipProvider>
      <HashRouter>
        <ArchiveProjectProvider project={ARCHIVE_DATA.project} availableTypes={ARCHIVE_DATA.availableTypes}>
          <Routes>
            <Route element={<ArchiveLayout />}>
              <Route index element={<Navigate to="/awareness" replace />} />
              <Route path="/awareness" element={<BrandAwareness />} />
              <Route path="/perception" element={<Perception />} />
              <Route path="/digital" element={<DigitalAudit />} />
              <Route path="/availability" element={<Availability />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/media" element={<MediaCreatives />} />
              <Route path="/media-details" element={<MediaDetails />} />
              <Route path="/insights" element={<StrategyInsights />} />
            </Route>
          </Routes>
        </ArchiveProjectProvider>
      </HashRouter>
    </TooltipProvider>
  );
}
