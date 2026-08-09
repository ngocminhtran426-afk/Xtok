import React from 'react';
import { Search } from 'lucide-react';

const MobileHeader = () => {
  return (
    <div className="mobile-header">
      <div className="mobile-header-tabs">
        <span className="mobile-tab">Đang Follow</span>
        <span className="mobile-tab active">Dành cho bạn</span>
      </div>
      <div className="mobile-search-icon">
        <Search size={24} color="#fff" />
      </div>
    </div>
  );
};

export default MobileHeader;
