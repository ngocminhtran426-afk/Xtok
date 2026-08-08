import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, MessageSquare, Inbox, User, Settings, Shield, LogOut, Camera, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SettingsModal from './SettingsModal';
import AvatarCropModal from './AvatarCropModal';
import WatchHistoryModal from './WatchHistoryModal';
import axios from 'axios';

const Header = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState(null);
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Read the file as a data URL for the cropper
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setSelectedImageSrc(reader.result);
      setIsDropdownOpen(false); // Close dropdown so it doesn't overlap the modal
    });
    reader.readAsDataURL(file);
    
    // Reset input value so the same file can be selected again
    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob) => {
    const formData = new FormData();
    formData.append('avatar', croppedBlob, 'avatar.jpg');
    
    try {
      setIsUploading(true);
      const res = await axios.post('/api/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        updateUser({ avatar_url: res.data.avatar_url });
        setSelectedImageSrc(null); // Close modal
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="top-actions">
      <button className="btn-upload">
        <Plus size={16} style={{ marginRight: 8, display: 'inline' }} />
        Tải lên
      </button>
      <button>
        <MessageSquare size={24} />
      </button>
      <button onClick={() => setIsSettingsOpen(true)}>
        <Settings size={24} />
      </button>
      <button>
        <Inbox size={24} />
      </button>
      
      <div style={{ position: 'relative' }} ref={dropdownRef}>
        <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} style={{ padding: 0, overflow: 'hidden', borderRadius: '50%', width: '32px', height: '32px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ccc' }}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <User size={32} style={{ color: '#333' }} />
          )}
        </button>
        
        {isDropdownOpen && (
          <div style={{
            position: 'absolute',
            top: '40px',
            right: '0',
            backgroundColor: '#252525',
            borderRadius: '8px',
            padding: '8px',
            width: '200px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '4px', fontWeight: 'bold' }}>
              @{user?.username}
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              onChange={handleFileChange} 
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', width: '100%', borderRadius: '4px', textAlign: 'left', cursor: isUploading ? 'not-allowed' : 'pointer', background: 'transparent', border: 'none', color: 'white', transition: 'background 0.2s', opacity: isUploading ? 0.5 : 1 }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Camera size={18} /> {isUploading ? 'Đang tải...' : 'Đổi Avatar'}
            </button>
            
            <button 
              onClick={() => { setIsDropdownOpen(false); setIsHistoryOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', width: '100%', borderRadius: '4px', textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 'none', color: 'white', transition: 'background 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Clock size={18} /> Lịch sử xem
            </button>
            
            {user?.role === 'ADMIN' && (
              <button 
                onClick={() => { setIsDropdownOpen(false); navigate('/admin'); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', width: '100%', borderRadius: '4px', textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 'none', color: 'white', transition: 'background 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Shield size={18} /> Quản trị Admin
              </button>
            )}
            
            <button 
              onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', width: '100%', borderRadius: '4px', textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 'none', color: '#ff4444', transition: 'background 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <LogOut size={18} /> Đăng xuất
            </button>
          </div>
        )}
      </div>
      
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      <WatchHistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      
      <AvatarCropModal 
        isOpen={!!selectedImageSrc}
        imageSrc={selectedImageSrc}
        onClose={() => setSelectedImageSrc(null)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
};
export default Header;
