import React, { useState, useEffect } from 'react';
import { X, Play } from 'lucide-react';
import axios from 'axios';

const WatchHistoryModal = ({ isOpen, onClose }) => {
  const [historyVideos, setHistoryVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      axios.get('/api/videos/history')
        .then(res => {
          setHistoryVideos(res.data);
        })
        .catch(err => {
          console.error("Failed to load history", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={{ margin: 0, fontSize: '20px' }}>Lịch sử xem</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div style={styles.content}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Đang tải...</div>
          ) : historyVideos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              Bạn chưa xem video nào.
            </div>
          ) : (
            <div style={styles.grid}>
              {historyVideos.map((video, idx) => (
                <div key={`${video.id}-${idx}`} style={styles.videoItem}>
                  <img src={video.thumb_url} alt="Thumbnail" style={styles.thumbnail} />
                  <div style={styles.videoOverlay}>
                    <Play size={32} color="white" fill="white" />
                  </div>
                  <div style={styles.videoInfo}>
                    <div style={styles.videoDesc}>{video.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#1e1e1e',
    width: '90%',
    maxWidth: '800px',
    maxHeight: '80vh',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
  },
  header: {
    padding: '20px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
  },
  content: {
    padding: '20px',
    overflowY: 'auto',
    flex: 1,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '16px',
  },
  videoItem: {
    position: 'relative',
    aspectRatio: '9/16',
    backgroundColor: '#333',
    borderRadius: '8px',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transition: 'opacity 0.2s',
  },
  videoInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '8px',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
  },
  videoDesc: {
    fontSize: '12px',
    color: 'white',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  }
};

// Add global hover styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    div[style*="aspectRatio: '9/16'"]:hover > div:nth-child(2) {
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(style);
}

export default WatchHistoryModal;
