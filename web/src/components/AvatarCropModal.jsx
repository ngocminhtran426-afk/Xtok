import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';

const AvatarCropModal = ({ isOpen, imageSrc, onClose, onCropComplete }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropCompleteHandler = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    try {
      setIsProcessing(true);
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      await onCropComplete(croppedImageBlob);
    } catch (e) {
      console.error(e);
      alert('Không thể cắt ảnh!');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>Cắt Ảnh Đại Diện</h2>
        
        <div style={styles.cropContainer}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onCropComplete={onCropCompleteHandler}
            onZoomChange={setZoom}
          />
        </div>

        <div style={styles.controls}>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => setZoom(e.target.value)}
            style={styles.slider}
          />
        </div>

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose} disabled={isProcessing}>
            Hủy
          </button>
          <button style={styles.saveBtn} onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? 'Đang xử lý...' : 'Áp dụng'}
          </button>
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#252525',
    borderRadius: '12px',
    width: '400px',
    maxWidth: '90vw',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  title: {
    padding: '16px',
    margin: 0,
    fontSize: '18px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    textAlign: 'center',
  },
  cropContainer: {
    position: 'relative',
    height: '300px',
    width: '100%',
    backgroundColor: '#000',
  },
  controls: {
    padding: '16px',
    display: 'flex',
    justifyContent: 'center',
  },
  slider: {
    width: '80%',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '16px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  saveBtn: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: 'none',
    background: 'var(--primary-color)',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
};

export default AvatarCropModal;
