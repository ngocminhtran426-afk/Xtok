import React, { useState } from 'react';
import { X } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose }) => {
  const [mainDomain, setMainDomain] = useState(localStorage.getItem('xnhau_mainDomain') || 'https://xnhau.ink');
  const [cdnDomain, setCdnDomain] = useState(localStorage.getItem('xnhau_cdnDomain') || 'https://m.xnhau.ink');

  const handleSave = () => {
    localStorage.setItem('xnhau_mainDomain', mainDomain);
    localStorage.setItem('xnhau_cdnDomain', cdnDomain);
    
    // Save to settings.json for main.cjs to read
    try {
      const fs = window.require('fs');
      const path = window.require('path');
      const settingsPath = path.join(process.cwd(), 'settings.json');
      fs.writeFileSync(settingsPath, JSON.stringify({ mainDomain, cdnDomain }, null, 2));
    } catch (e) {
      console.error('Cannot save settings.json', e);
    }

    alert('Đã lưu cấu hình tên miền! Khởi động lại App để áp dụng cho thuật toán vượt tường lửa.');
    onClose();
    window.location.reload(); // Reload to apply new video domains
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={overlayStyle}>
      <div className="modal-content" style={contentStyle}>
        <div className="modal-header" style={headerStyle}>
          <h2 style={{margin: 0, fontSize: '18px'}}>Cấu hình Tên miền xNhau</h2>
          <button className="close-btn" style={closeBtnStyle} onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body" style={bodyStyle}>
          <div className="form-group" style={formGroupStyle}>
            <label style={labelStyle}>Tên miền Trang chủ (Dùng để vượt Cloudflare):</label>
            <input 
              type="text" 
              value={mainDomain} 
              onChange={(e) => setMainDomain(e.target.value)}
              placeholder="VD: https://xnhau.ink"
              style={inputStyle}
            />
          </div>
          <div className="form-group" style={formGroupStyle}>
            <label style={labelStyle}>Tên miền Máy chủ Video (CDN):</label>
            <input 
              type="text" 
              value={cdnDomain} 
              onChange={(e) => setCdnDomain(e.target.value)}
              placeholder="VD: https://m.xnhau.ink"
              style={inputStyle}
            />
          </div>
          <p style={{ fontSize: '12px', color: '#888', marginTop: '10px' }}>
            * Chú ý: Hãy nhập đầy đủ "https://". Các video cũ sẽ tự động mượn tên miền mới này để tải.
          </p>
        </div>
        <div className="modal-footer" style={footerStyle}>
          <button style={{...btnStyle, backgroundColor: '#333'}} onClick={onClose}>Hủy</button>
          <button style={{...btnStyle, backgroundColor: 'var(--primary-color)'}} onClick={handleSave}>Lưu Cài đặt</button>
        </div>
      </div>
    </div>
  );
};

// Inline styles for simplicity
const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 999999
};
const contentStyle = {
  backgroundColor: '#222', borderRadius: '8px',
  width: '400px', maxWidth: '90%',
  display: 'flex', flexDirection: 'column'
};
const headerStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px', borderBottom: '1px solid #333'
};
const closeBtnStyle = {
  background: 'none', border: 'none', color: '#fff', cursor: 'pointer'
};
const bodyStyle = {
  padding: '16px'
};
const formGroupStyle = {
  marginBottom: '16px'
};
const labelStyle = {
  display: 'block', marginBottom: '8px', fontSize: '14px', color: '#ccc'
};
const inputStyle = {
  width: '100%', padding: '10px',
  backgroundColor: '#111', border: '1px solid #444',
  color: '#fff', borderRadius: '4px', boxSizing: 'border-box'
};
const footerStyle = {
  padding: '16px', borderTop: '1px solid #333',
  display: 'flex', justifyContent: 'flex-end', gap: '10px'
};
const btnStyle = {
  padding: '8px 16px', border: 'none', borderRadius: '4px',
  color: '#fff', cursor: 'pointer', fontWeight: 'bold'
};

export default SettingsModal;
