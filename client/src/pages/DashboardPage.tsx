import React from 'react';
import { Navigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => <Navigate to="/play" replace />;
export default DashboardPage;
