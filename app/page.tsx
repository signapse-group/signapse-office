import TopBar from '@/components/office/TopBar';
import SessionRail from '@/components/office/SessionRail';
import Stage from '@/components/office/Stage';
import ActivityPanel from '@/components/office/ActivityPanel';
import SessionDrawer from '@/components/office/SessionDrawer';
import MacDrawer from '@/components/office/MacDrawer';
import BurnDrawer from '@/components/office/BurnDrawer';
import VaultDrawer from '@/components/office/VaultDrawer';
import WrappedModal from '@/components/office/WrappedModal';
import Toast from '@/components/office/Toast';
import OfficeBoot from '@/components/OfficeBoot';

// Local rendering reads the requested language. Static export renders each language once.
export default function OfficePage() {
  return (
    <div id="app" data-sessions="closed" data-activity="closed">
      <TopBar />
      <SessionRail />
      <Stage />
      <ActivityPanel />
      <SessionDrawer />
      <MacDrawer />
      <BurnDrawer />
      <VaultDrawer />
      <WrappedModal />
      <Toast />
      <OfficeBoot />
    </div>
  );
}
