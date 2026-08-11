import React, { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Share2, Music, Plus, Bookmark, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

let globalMuted = true;
let globalVolume = 1; // Default to 1 so when unmuted, it has volume

const VideoCard = ({ video, isActive, onVideoEnd }) => {
  const [playing, setPlaying] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(globalVolume);
  const [isMuted, setIsMuted] = useState(globalMuted);
  const [resolvedMp4Url, setResolvedMp4Url] = useState(null);
  const [useEmbedFallback, setUseEmbedFallback] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
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
      const targetUrl = `https://xnhau.ink/embed/${videoId}`;
      const fallbackUrl = `https://xnhau.ink/video/${videoId}.mp4`;
      
      const handleMessage = (event) => {
        if (event.data && event.data.type === "FETCH_XNHAU_RESULT" && event.data.url === targetUrl) {
          window.removeEventListener("message", handleMessage);
          if (event.data.error === "EXTENSION_DISCONNECTED" || event.data.error === "Tab proxy failed") {
            alert("⚠️ LỖI KẾT NỐI EXTENSION ⚠️\n\nExtension vừa được cập nhật nhưng trang web chưa nhận diện được.\n\nVUI LÒNG LÀM THEO 2 BƯỚC:\n1. F5 (Tải lại) trang web XTok này.\n2. Đóng tab xác minh cũ, bấm Nút Đỏ để mở tab xác minh mới.");
            setNeedsVerification(true);
          } else if (event.data.error === "No xnhau tab open" || event.data.error === "CAPTCHA") {
            setNeedsVerification(true);
          } else if (event.data.error === "NO_MP4") {
            setNeedsVerification(false);
            setUseEmbedFallback(true);
          } else if (event.data.mp4Url) {
            setResolvedMp4Url(event.data.mp4Url);
          } else {
            setNeedsVerification(true);
          }
        }
      };
      
      window.addEventListener("message", handleMessage);
      window.postMessage({ type: "FETCH_XNHAU", url: targetUrl }, "*");
      
      // Timeout fallback in case extension is not running
      setTimeout(() => {
        window.removeEventListener("message", handleMessage);
        setResolvedMp4Url(prev => prev || fallbackUrl);
      }, 3000);
    }
  }, [video.file_url, isTiktok, useEmbedFallback, rawMp4Url, retryCount]);
  
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

  const [videoStyles, setVideoStyles] = useState(null);
  const [isReady, setIsReady] = useState(false);

  const calculateDimensions = React.useCallback((width, height) => {
    const maxH = window.innerHeight - 32; // Khôi phục chiều cao tối đa để video dọc full màn hình
    const availableW = window.innerWidth - 550; // Giữ nguyên việc bóp chiều ngang để video ngang nhỏ lại
    const maxW = Math.max(300, availableW);
    
    let targetW = maxW;
    let targetH = targetW * (height / width);
    
    if (targetH > maxH) {
      targetH = maxH;
      targetW = targetH * (width / height);
    }
    setVideoStyles({ width: `${targetW}px`, height: `${targetH}px` });
    setIsReady(true);
  }, []);

  useEffect(() => {
    // Nếu là Webview/Iframe thì không có metadata, fallback về 9:16
    if (isTiktok || useEmbedFallback) {
      calculateDimensions(720, 1280);
    }
  }, [isTiktok, useEmbedFallback, calculateDimensions]);

  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      // Bỏ qua resize tạm thời, hoặc có thể reload
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
  }, []);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      calculateDimensions(videoRef.current.videoWidth || 720, videoRef.current.videoHeight || 1280);
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

  // Ẩn nội dung chờ lấy được video metadata thật để không bị layout shift
  const currentStyles = videoStyles || { width: '400px', height: 'calc(100vh - 32px)' };

  return (
    <div className="video-card-container" ref={ref}>
      <div 
        className="video-wrapper" 
        style={{ ...currentStyles, position: 'relative', overflow: 'hidden', borderRadius: '12px', opacity: (isReady || needsVerification) ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }}
      >
        {/* Lớp nền mờ giống hệt Tiktok Web */}
        <div 
          style={{
            position: 'absolute', top: '-10%', left: '-10%', right: '-10%', bottom: '-10%',
            backgroundImage: `url(${video.thumb_url})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(30px)', opacity: 0.4, zIndex: 0
          }}
        />

        {needsVerification && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: '20px', textAlign: 'center' }}>
            <div style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>Cần xác minh bảo mật</div>
            <div style={{ marginBottom: '24px', fontSize: '14px', color: '#ccc', maxWidth: '300px', lineHeight: '1.5' }}>
              Trang đích yêu cầu xác minh Captcha. Vui lòng nhấn nút bên dưới để mở trang mồi ở Tab mới. <br/><br/>
              <b>LƯU Ý QUAN TRỌNG:</b> Sau khi giải Captcha xong, <b>KHÔNG ĐƯỢC ĐÓNG TAB ĐÓ</b>. Hãy giữ Tab đó mở để Extension có thể làm trạm lấy link video.
            </div>
            <button 
              onClick={() => {
                const vid = isTiktok ? '' : video.file_url.split(':')[1];
                if (vid) {
                  window.open(`https://xnhau.ink/embed/${vid}`, '_blank', 'width=500,height=600');
                }
              }}
              style={{ padding: '12px 24px', backgroundColor: '#fe2c55', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '16px', outline: 'none' }}
            >
              Mở trang xác minh
            </button>
            <button 
              onClick={() => {
                setNeedsVerification(false);
                setRetryCount(c => c + 1);
              }}
              style={{ padding: '10px 20px', backgroundColor: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', outline: 'none' }}
            >
              Đã mở và giải Captcha, Tải lại
            </button>
          </div>
        )}

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
                preload="metadata"
                loop
                muted={isMuted}
                autoPlay
                playsInline
                referrerPolicy="no-referrer"
                onClick={togglePlay}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                style={{ position: 'relative', zIndex: 1 }}
                onError={() => {
                  console.log("MP4 load failed, asking user to verify");
                  setNeedsVerification(true);
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

      {/* Floating Actions (Right Side) */}
      <div className="floating-actions" style={{ opacity: isReady ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }}>
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
