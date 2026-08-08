import React, { useState, useEffect } from 'react';
import { Home, Compass, UserCheck, Tv, PlusSquare, Search, User } from 'lucide-react';
import axios from 'axios';

const Sidebar = () => {
  const [topUsers, setTopUsers] = useState([]);

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
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span style={{ color: 'var(--primary-color)' }}>♪</span> TikTok
      </div>
      
      <div className="sidebar-search">
        <div className="search-input-wrapper">
          <Search size={18} color="var(--text-secondary)" />
          <input type="text" placeholder="Tìm kiếm" />
        </div>
      </div>

      <div className="sidebar-item active">
        <Home size={24} />
        Đề xuất
      </div>
      <div className="sidebar-item">
        <Compass size={24} />
        Khám phá
      </div>
      <div className="sidebar-item">
        <UserCheck size={24} />
        Đã follow
      </div>
      <div className="sidebar-item">
        <Tv size={24} />
        LIVE
      </div>
      <div className="sidebar-item">
        <PlusSquare size={24} />
        Tải lên
      </div>
      
      <div className="sidebar-divider"></div>
      
      <div style={{ padding: '0 12px', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
        Các tài khoản đang follow
      </div>
      
      {topUsers.map(u => (
        <div key={u.id} className="sidebar-item" style={{ padding: '8px 12px', gap: '12px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {u.avatar_url ? (
              <img src={u.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <User size={20} color="#ccc" />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: 14, fontWeight: 'bold', lineHeight: '1' }}>{u.username}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 'normal', lineHeight: '1' }}>User {u.id}</span>
          </div>
        </div>
      ))}
    </aside>
  );
};

export default Sidebar;
