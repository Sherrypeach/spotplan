import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthRoutes } from '@modules/auth/AuthRoutes';
import { HowToUsePage } from '@modules/help/HowToUsePage';
import { HOW_TO_USE_PATH } from '@modules/help/paths';
import { ProtectedRoute } from '@modules/auth/ProtectedRoute';
import { RoomStep } from '@modules/room/RoomStep';
import { SeatsStep } from '@modules/seats/SeatsStep';
import { ChartStep } from '@modules/chart/ChartStep';
import { AppShell } from '@modules/shell/AppShell';
import { STEPS } from '@modules/steps/steps';
import { StudentsStep } from '@modules/students/StudentsStep';

export function App() {
  return (
    <Routes>
      <Route path="/auth/*" element={<AuthRoutes />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to={STEPS[0].path} replace />} />
          <Route path={STEPS[0].path} element={<StudentsStep />} />
          <Route path={STEPS[1].path} element={<RoomStep />} />
          <Route path={STEPS[2].path} element={<SeatsStep />} />
          <Route path={STEPS[3].path} element={<ChartStep />} />
          <Route path={HOW_TO_USE_PATH} element={<HowToUsePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
