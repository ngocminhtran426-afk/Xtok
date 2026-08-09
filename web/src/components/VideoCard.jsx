import React, { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Share2, Music, Plus, Bookmark, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

let globalMuted = true;
let globalVolume = 1; // Default to 1 so when unmuted, it has volume

const VideoCard = ({ video }) => {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(globalVolume);
  const [isMuted, setIsMuted] = useState(globalMuted);
  const [resolvedMp4Url, setResolvedMp4Url] = useState(null);
  const [useEmbedFallback, setUseEmbedFallback] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const videoRef = useRef(null);
  const bgVideoRef = useRef(null);
  const hasMarkedSeen = useRef(false);
  const { user } = useAuth();
  
  // Intersection Observer to handle autoplay
  const { ref, inView } = useInView({
    threshold: 0.6, // Play when 60% of the video is visible
  });

  useEffect(() => {
    let seenTimer;
    if (inView) {
      if (videoRef.current) {
        // Cập nhật lại volume/muted trong trường hợp video vừa mount
        videoRef.current.muted = globalMuted;
        videoRef.current.volume = globalMuted ? 0 : globalVolume;
        videoRef.current.play().catch(e => console.log('Autoplay blocked', e));
      }
      if (bgVideoRef.current) {
        bgVideoRef.current.muted = true;
        bgVideoRef.current.play().catch(e => console.log('Bg autoplay blocked', e));
      }
      setPlaying(true);
      
      // Mark as seen after watching for 3 seconds
      if (user && !hasMarkedSeen.current) {
        seenTimer = setTimeout(() => {
          axios.post('/api/videos/seen', { video_id: video.id })
            .catch(e => console.log('Failed to log watch history:', e));
          hasMarkedSeen.current = true;
        }, 3000);
      }
    } else {
      videoRef.current?.pause();
      bgVideoRef.current?.pause();
      setPlaying(false);
      if (seenTimer) clearTimeout(seenTimer);
    }
    
    return () => {
      if (seenTimer) clearTimeout(seenTimer);
    };
  }, [inView, video.id, user]);

  useEffect(() => {
    if (retryCount > 0 && videoRef.current && inView) {
      videoRef.current.play().catch(e => console.log('Autoplay blocked after retry', e));
    }
  }, [retryCount, inView, resolvedMp4Url]);

  const iframeRef = useRef(null);

  // Phân loại Link Video
  const isTiktok = video.file_url?.includes('tiktok.com');
  const cdnDomain = localStorage.getItem('xnhau_cdnDomain') || 'https://m.xnhau.ink';
  const mainDomain = localStorage.getItem('xnhau_mainDomain') || 'https://xnhau.ink';

  let rawMp4Url = '';
  let embedSrc = '';

  if (video.file_url?.startsWith('xnhau:')) {
    // Dữ liệu mới lưu dưới dạng xnhau:ID
    const id = parseInt(video.file_url.split(':')[1], 10);
    if (!isNaN(id)) {
      embedSrc = `${mainDomain}/embed/${id}`;
    }
  } else if (video.file_url?.includes('<iframe')) {
    // Tương thích ngược với dữ liệu cũ (chứa thẻ iframe)
    embedSrc = video.file_url.match(/src="([^"]+)"/)?.[1] || '';
    if (embedSrc) {
      embedSrc = embedSrc.replace(/^https?:\/\/[^\/]+/, mainDomain);
      const matchId = embedSrc.match(/\/embed\/(\d+)/);
      if (matchId) {
        const id = parseInt(matchId[1], 10);
        embedSrc = `${mainDomain}/embed/${id}`;
      }
    }
  } else if (!isTiktok && video.file_url) {
    rawMp4Url = video.file_url;
  }

  // Fetch dynamic MP4 URL with token
  useEffect(() => {
    if (isTiktok || useEmbedFallback || rawMp4Url) return;
    
    let videoId = null;
    if (video.file_url?.startsWith('xnhau:')) {
      videoId = video.file_url.split(':')[1];
    } else if (video.file_url?.includes('<iframe')) {
      const matchId = video.file_url.match(/\/embed\/(\d+)/);
      if (matchId) videoId = matchId[1];
    }

    if (videoId) {
      axios.get(`/api/videos/resolve/${videoId}`)
        .then(res => {
          if (res.data.url) setResolvedMp4Url(res.data.url);
          else setUseEmbedFallback(true);
        })
        .catch(err => {
          console.error("Failed to resolve MP4 URL:", err);
          setUseEmbedFallback(true);
        });
    }
  }, [video.file_url, isTiktok, useEmbedFallback, rawMp4Url]);
  
  const finalMp4Url = rawMp4Url || resolvedMp4Url;

  const togglePlay = () => {
    setPlaying(!playing);
    if (isTiktok && iframeRef.current) {
      if (playing) iframeRef.current.executeJavaScript(`document.querySelector('video')?.pause();`);
      else iframeRef.current.executeJavaScript(`document.querySelector('video')?.play();`);
    } else if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // TÍNH KÍCH THƯỚC KHUNG VIDEO NGAY TỪ ĐẦU (giống TikTok)
  // Lấy độ phân giải từ API trả về để set khung ngay lập tức, tránh bị giật chớp (Layout Shift) khi video load xong
  // TikTok Web UI: Khung video luôn cố định tỷ lệ 9:16 (hoặc vừa màn hình).
  // Background sẽ là ảnh thumbnail làm mờ (nền nhạc màu) để video không bị lọt thỏm trong hộp đen.
  const [videoStyles, setVideoStyles] = useState(null);

  useEffect(() => {
    // Luôn khóa cứng tỷ lệ khung hình giống hệt TikTok Web (cỡ dọc điện thoại)
    const maxH = window.innerHeight - 32;
    let targetH = maxH;
    let targetW = targetH * (9 / 16);
    
    // Nếu màn hình quá hẹp, bóp theo chiều ngang
    const availableW = window.innerWidth - 350;
    if (targetW > availableW) {
      targetW = availableW;
      targetH = targetW * (16 / 9);
    }
    
    setVideoStyles({ width: `${targetW}px`, height: `${targetH}px` });
  }, []);

  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const maxH = window.innerHeight - 32;
        let targetH = maxH;
        let targetW = targetH * (9 / 16);
        const availableW = window.innerWidth - 350;
        if (targetW > availableW) {
          targetW = availableW;
          targetH = targetW * (16 / 9);
        }
        setVideoStyles({ width: `${targetW}px`, height: `${targetH}px` });
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Sync volume across VideoCards
    const handleGlobalVolumeChange = (e) => {
      const { vol, muted } = e.detail;
      setVolume(vol);
      setIsMuted(muted);
      if (videoRef.current) {
        videoRef.current.volume = vol;
        videoRef.current.muted = muted;
      }
    };
    window.addEventListener('syncvolume', handleGlobalVolumeChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('syncvolume', handleGlobalVolumeChange);
      clearTimeout(timeoutId);
    };
  }, [calculateDimensions]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const time = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e) => {
    const val = Number(e.target.value);
    const muted = val === 0;
    setVolume(val);
    setIsMuted(muted);
    globalVolume = val;
    globalMuted = muted;
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = muted;
    }
    window.dispatchEvent(new CustomEvent('syncvolume', { detail: { vol: val, muted } }));
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    globalMuted = newMuted;
    
    // Khôi phục mức âm lượng cũ hoặc mặc định là 1 nếu mở tiếng
    const newVol = newMuted ? 0 : (globalVolume === 0 ? 1 : globalVolume);
    if (!newMuted) globalVolume = newVol;

    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
      videoRef.current.volume = newVol;
    }
    window.dispatchEvent(new CustomEvent('syncvolume', { detail: { vol: newVol, muted: newMuted } }));
  };

  const formatTime = (timeInSeconds) => {
    const m = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleTiktokReady = (e) => {
    const webview = e.target;
    webview.executeJavaScript(`
      (() => {
        const style = document.createElement('style');
        style.textContent = \`
          body, html { margin: 0; padding: 0; overflow: hidden; background: #000; }
          /* Ẩn toàn bộ UI của Tiktok Web */
          div[class*="DivBottomContainer"], div[class*="DivHeaderContainer"], div[class*="DivSideBarContainer"], div[class*="DivInfoContainer"], div[class*="DivVideoWrapper"] > div:not(video), header, svg, a, button { display: none !important; opacity: 0 !important; pointer-events: none !important; }
          video { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; object-fit: contain !important; z-index: 9999 !important; display: block !important; outline: none !important; border: none !important; pointer-events: none !important; }
        \`;
        document.head.appendChild(style);

        const tryPlay = setInterval(() => {
          const v = document.querySelector('video');
          if (v) {
            v.style.cssText = "position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; object-fit: contain !important; z-index: 999999 !important; pointer-events: none !important;";
            if (v.paused) v.play().catch(()=>{});
            else clearInterval(tryPlay);
          }
        }, 500);
        setTimeout(() => clearInterval(tryPlay), 15000);
      })();
    `);
    setVolume(newVol);
  };

  if (!videoStyles) {
    return (
      <div className="video-card-container">
        <div className="video-wrapper" style={{ width: '400px', height: 'calc(100vh - 32px)', backgroundColor: '#111', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: '-10%', left: '-10%', right: '-10%', bottom: '-10%',
            backgroundImage: `url(${video.thumb_url})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(30px)', opacity: 0.4
          }} />
        </div>
      </div>
    );
  }

  return (
    <div className="video-card-container" ref={ref}>
      <div className="video-wrapper" style={{ ...videoStyles, position: 'relative', overflow: 'hidden', borderRadius: '12px' }}>
        {/* Lớp nền mờ giống hệt Tiktok Web */}
        <div 
          style={{
            position: 'absolute', top: '-10%', left: '-10%', right: '-10%', bottom: '-10%',
            backgroundImage: `url(${video.thumb_url})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(30px)', opacity: 0.4, zIndex: 0
          }}
        />

        {isTiktok || (useEmbedFallback && embedSrc) ? (
          <div className="webview-container" style={{ 
            backgroundPosition: 'center' 
          }}>
            {inView ? (
              <>
                <iframe 
                  ref={iframeRef}
                  src={isTiktok ? video.file_url : embedSrc}
                  className="webview-element"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allow="autoplay"
                />
                {isTiktok && <div className="click-overlay" onClick={togglePlay} />}
              </>
            ) : null}
          </div>
        ) : finalMp4Url && !useEmbedFallback ? (
          <div className="video-element iframe-wrapper" style={{ 
            position: 'relative', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center',
            backgroundImage: `url(${video.thumb_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}>
            {inView ? (
              <video 
                key={retryCount}
                ref={videoRef}
                src={finalMp4Url}
                className="video-element"
                loop
                muted={isMuted}
                autoPlay
                playsInline
                onClick={togglePlay}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onError={() => {
                  console.log("MP4 load failed, falling back to embed player");
                  setUseEmbedFallback(true);
                }}
              />
            ) : null}
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '12px' }}>
            <span style={{ fontSize: '16px' }}>Video bị chặn hoặc không tìm thấy (CORS)</span>
            <button 
              className="retry-btn"
              disabled={isRetrying}
              style={{ padding: '8px 24px', background: isRetrying ? '#555' : 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: isRetrying ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
              onClick={async (e) => {
                e.stopPropagation();
                if (isRetrying || !finalMp4Url) return;
                
                setIsRetrying(true);
                setRetryCount(Date.now());
                
                try {
                  // Gửi request HEAD kèm cache: 'reload' để ép Chrome tải lại và đè lên cache bị lỗi CORS cũ
                  await fetch(finalMp4Url, { method: 'HEAD', cache: 'reload' });
                } catch (err) {
                  console.log("Fetch cache bypass failed, proceeding anyway", err);
                }

                // Đợi thêm 1 chút để đảm bảo cache trình duyệt được cập nhật
                setTimeout(() => {
                  setUseEmbedFallback(false);
                  setIsRetrying(false);
                }, 300);
              }}
            >
              {isRetrying ? 'Đang tải lại...' : 'Tải lại video'}
            </button>
          </div>
        )}
        
        {/* Floating Info & Controls container */}
        <div className="bottom-controls-container">
          <div className="floating-info">
            <div className="user-nickname">{video.user.nickname}</div>
            <div className="video-desc">{video.description}</div>
            <div className="music-tag">
              <Music size={14} /> {video.music}
            </div>
          </div>
          
          {/* Custom Player Controls for native MP4 only */}
          {!isTiktok && !useEmbedFallback && finalMp4Url && (
            <div className="player-controls">
              <div className="play-btn" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
                {playing ? <Pause size={20} color="white" /> : <Play size={20} color="white" />}
              </div>
              <div className="time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              <div className="progress-bar-container">
                <input 
                  type="range" 
                  min="0" 
                  max={duration || 100} 
                  value={currentTime} 
                  onChange={handleSeek}
                  onClick={(e) => e.stopPropagation()}
                  className="progress-bar"
                />
              </div>
              <div className="volume-control">
                <div className="mute-btn" onClick={toggleMute}>
                  {isMuted || volume === 0 ? <VolumeX size={20} color="white" /> : <Volume2 size={20} color="white" />}
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  onClick={(e) => e.stopPropagation()}
                  className="volume-slider"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Actions on the right (Outside wrapper for desktop layout) */}
      <div className="floating-actions">
        <div className="action-avatar">
          <img src={video.user.avatar} alt="avatar" />
          <div className="follow-btn"><Plus size={12} color="white"/></div>
        </div>
        
        <button className="action-btn">
          <div className="action-icon"><Heart size={24} /></div>
          <span className="action-count">{video.likes_count}</span>
        </button>
        <button className="action-btn">
          <div className="action-icon"><MessageCircle size={24} /></div>
          <span className="action-count">{video.comments_count}</span>
        </button>
        <button className="action-btn">
          <div className="action-icon"><Bookmark size={24} /></div>
          <span className="action-count">{video.likes_count ? Math.floor(video.likes_count * 0.1) : 0}</span>
        </button>
        <button className="action-btn">
          <div className="action-icon"><Share2 size={24} /></div>
          <span className="action-count">{video.shares_count}</span>
        </button>
        <div className="music-disc">
          <img src={video.user.avatar} alt="music" />
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
