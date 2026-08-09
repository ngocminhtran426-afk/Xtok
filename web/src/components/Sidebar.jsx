import React, { useState, useEffect } from 'react';
import { Home, Compass, UserCheck, Tv, PlusSquare, Search, User, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Sidebar = () => {
  const [topUsers, setTopUsers] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTopUsers = async () => {
      try {
        const res = await axios.get('/api/users/top');
        setTopUsers(res.data);
      } catch (err) {
        console.error('Failed to fetch top users:', err);
      }
    };
    fetchTopUsers();
  }, []);

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', padding: isCollapsed ? '0' : '16px 12px', gap: '12px' }}>
        <button className={`menu-toggle-btn ${isCollapsed ? 'floating' : ''}`} onClick={() => setIsCollapsed(!isCollapsed)}>
          <Menu size={28} />
        </button>
        <div className="sidebar-header-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
          <div className="sidebar-logo" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: 0, margin: 0 }} onClick={() => window.location.href = '/'}>
            <img src="/logo.png" alt="XTok Logo" style={{ height: '32px', borderRadius: '50%' }} />
            <span style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px', lineHeight: 1 }}>XTok</span>
          </div>
        </div>
      </div>
      
      <div className="sidebar-search">
        <div className="search-input-wrapper">
          <Search size={18} color="var(--text-secondary)" />
          <input type="text" placeholder="Tìm kiếm" />
        </div>
      </div>

      <div className="sidebar-item active">
        <Home size={24} />
        <span className="sidebar-item-text">Đề xuất</span>
      </div>
      <div className="sidebar-item">
        <Compass size={24} />
        <span className="sidebar-item-text">Khám phá</span>
      </div>
      <div className="sidebar-item">
        <UserCheck size={24} />
        <span className="sidebar-item-text">Đã follow</span>
      </div>
      <div className="sidebar-item">
        <Tv size={24} />
        <span className="sidebar-item-text">LIVE</span>
      </div>
      <div className="sidebar-item">
        <PlusSquare size={24} />
        <span className="sidebar-item-text">Tải lên</span>
      </div>
      
      <div className="sidebar-divider"></div>
      
      <div className="follow-title" style={{ padding: '0 12px', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
        Các tài khoản đang follow
      </div>
      
      {topUsers.map(u => (
        <div key={u.id} className="sidebar-item" style={{ padding: '8px 12px', gap: '12px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {u.avatar_url ? (
              <img src={u.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <User size={20} color="#ccc" />
            )}
          </div>
          <div className="user-info-text" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: 14, fontWeight: 'bold', lineHeight: '1' }}>{u.username}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 'normal', lineHeight: '1' }}>@{u.username}</span>
          </div>
        </div>
      ))}
    </aside>
  );
};

export default Sidebar;
