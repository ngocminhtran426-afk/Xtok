import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import VideoFeed from './components/VideoFeed';
import Login from './pages/Login';
import Admin from './pages/Admin';

const PrivateRoute = ({ children, requireAdmin = false }) => {
  const { user, token } = useAuth();
  
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  
  if (requireAdmin && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

import MobileNav from './components/MobileNav';
import MobileHeader from './components/MobileHeader';

const MainLayout = () => (
  <div className="app-container">
    <MobileHeader />
    <Header />
    <div className="main-content">
      <Sidebar />
      <VideoFeed />
    </div>
    <MobileNav />
  </div>
);

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route 
        path="/admin" 
        element={
          <PrivateRoute requireAdmin={true}>
            <Admin />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/" 
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        } 
      />
    </Routes>
  );
}

export default App;
