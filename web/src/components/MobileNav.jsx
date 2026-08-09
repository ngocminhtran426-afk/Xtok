import React, { useState } from 'react';
import { Home, Search, PlusSquare, Inbox, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const MobileNav = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="mobile-nav">
      <Link to="/" className={`mobile-nav-item ${currentPath === '/' ? 'active' : ''}`}>
        <Home size={24} color={currentPath === '/' ? '#fff' : 'rgba(255,255,255,0.6)'} />
        <span>Trang chủ</span>
      </Link>
      <Link to="/explore" className={`mobile-nav-item ${currentPath === '/explore' ? 'active' : ''}`}>
        <Search size={24} color={currentPath === '/explore' ? '#fff' : 'rgba(255,255,255,0.6)'} />
        <span>Khám phá</span>
      </Link>
      <div className="mobile-nav-item upload-btn-container">
        <div className="mobile-upload-btn">
          <PlusSquare size={20} color="#000" fill="#fff" />
        </div>
      </div>
      <Link to="/inbox" className={`mobile-nav-item ${currentPath === '/inbox' ? 'active' : ''}`}>
        <Inbox size={24} color={currentPath === '/inbox' ? '#fff' : 'rgba(255,255,255,0.6)'} />
        <span>Hộp thư</span>
      </Link>
      <Link to="/profile" className={`mobile-nav-item ${currentPath === '/profile' ? 'active' : ''}`}>
        <User size={24} color={currentPath === '/profile' ? '#fff' : 'rgba(255,255,255,0.6)'} />
        <span>Hồ sơ</span>
      </Link>
    </div>
  );
};

export default MobileNav;
