// The 3D stage and everything that floats over it.
import { getT } from '@/i18n/server';
import TimelinePanel from './TimelinePanel';
import PlaceCard from './PlaceCard';
import CameraToolbar from './CameraToolbar';
import FirstPersonHud from './FirstPersonHud';
import ReplayBar from './ReplayBar';
import PhotoBar from './PhotoBar';

export default async function Stage() {
  const t = await getT();
  return (
    <main className="stage-wrap" id="stage-wrap">
      <div id="stage"></div>
      <TimelinePanel />
      <PlaceCard />
      <nav className="chips" id="chips" aria-label={t('ui.stage.chips')}></nav>
      <CameraToolbar />
      <FirstPersonHud />
      <div className="perm-stack" id="perm-stack" hidden aria-live="assertive"></div>
      <div className="incident" id="incident" hidden role="alert"></div>
      <ReplayBar />
      <PhotoBar />
    </main>
  );
}
