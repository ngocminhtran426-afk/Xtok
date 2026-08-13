import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Heart, MessageCircle, Share2, Music, Pause, Play, Volume2, VolumeX, Plus, Bookmark } from 'lucide-react';

const VideoCard = ({ video, inView, prefetchInView, setRefs, onMuteChange, globalMuted, globalVolume, onVolumeChange }) => {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const iframeRef = useRef(null);
  
  const isTiktok = video.file_url?.includes('tiktok.com');

  // Extract ID from xnhau.ink links
  const xnhauId = useMemo(() => {
    if (isTiktok) return null;
    let id = null;
    if (video.file_url) {
      if (video.file_url.startsWith('xnhau:')) {
        id = video.file_url.split(':')[1];
      } else {
        // Find the 6-digit ID or any number block that looks like the ID
        const matches = video.file_url.match(/(\d+)/g);
        if (matches && matches.length > 0) {
          // Usually the ID is the last or only number in the URL (e.g. /video/496593.mp4)
          id = matches[matches.length - 1];
        }
      }
    }
    return id;
  }, [video.file_url, isTiktok]);

  const embedSrc = isTiktok ? video.file_url : (xnhauId ? `https://xnhau.ink/embed/${xnhauId}` : '');

  useEffect(() => {
    const handleVideoState = (event) => {
      if (event.data && event.data.type === "XTOK_VIDEO_STATE") {
        setCurrentTime(event.data.currentTime || 0);
        setDuration(event.data.duration || 0);
        setPlaying(!event.data.paused);
      }
    };
    window.addEventListener("message", handleVideoState);
    return () => window.removeEventListener("message", handleVideoState);
  }, []);

  const togglePlay = useCallback(() => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    if (playing) {
      iframeRef.current.contentWindow.postMessage({ type: "XTOK_PAUSE" }, "*");
      setPlaying(false);
    } else {
      iframeRef.current.contentWindow.postMessage({ type: "XTOK_PLAY" }, "*");
      setPlaying(true);
    }
  }, [playing]);

  // Volume control syncing
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "XTOK_MUTE", value: globalMuted }, "*");
    }
  }, [globalMuted]);

  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      if (!inView) {
        iframeRef.current.contentWindow.postMessage({ type: "XTOK_PAUSE" }, "*");
        setPlaying(false);
      } else if (!needsVerification) {
        iframeRef.current.contentWindow.postMessage({ type: "XTOK_PLAY" }, "*");
        setPlaying(true);
      }
    }
  }, [inView, needsVerification, retryCount]);

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
  };

  return (
    <div className="video-card-container" ref={setRefs}>
      <div 
        className="video-wrapper" 
        style={{ width: '400px', height: 'calc(100vh - 32px)', position: 'relative', overflow: 'hidden', borderRadius: '12px', transition: 'opacity 0.3s ease-in-out' }}
      >
        <div 
          style={{
            position: 'absolute', top: '-10%', left: '-10%', right: '-10%', bottom: '-10%',
            backgroundImage: `url(${video.thumb_url})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(30px)', opacity: 0.4, zIndex: 0
          }}
        />

        {needsVerification && (
          <div style={{ position: 'absolute', top: 'auto', bottom: '60px', left: '10px', right: '10px', backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,59,92,0.5)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            <button 
              onClick={() => setNeedsVerification(false)}
              style={{ position: 'absolute', top: '5px', right: '10px', background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer', opacity: 0.7 }}
            >
              ✕
            </button>
            <h4 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '15px' }}>⚠️ Lỗi: Video bị chặn</h4>
            <p style={{ color: '#ccc', fontSize: '12px', marginBottom: '15px', textAlign: 'center' }}>
              Nếu video không tải được, hãy chờ hoặc nhấn Tải lại. (Có thể bạn cần giải Captcha hiển thị trên video)
            </p>
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button 
                onClick={async (e) => { 
                  e.stopPropagation();
                  setNeedsVerification(false); 
                  setRetryCount(prev => prev + 1); 
                  if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
                }}
                style={{ flex: 1, backgroundColor: 'transparent', color: 'white', border: '1px solid #ff3b5c', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
              >
                Tải lại
              </button>
            </div>
          </div>
        )}

        <div className="webview-container" style={{ 
          backgroundPosition: 'center',
          backgroundImage: `url(${video.thumb_url})`,
          backgroundSize: 'cover'
        }}>
          {inView ? (
            isTiktok ? (
              <webview 
                ref={iframeRef}
                src={embedSrc} 
                className="webview-element" 
                style={{ width: '100%', height: '100%', border: 'none', opacity: isReady ? 1 : 0, transition: 'opacity 0.3s' }}
                allowpopups="true" 
                webpreferences="contextIsolation=no" 
                onDomReady={handleTiktokReady}
                onLoadCommit={() => setIsReady(true)}
              />
            ) : (
              <iframe 
                ref={iframeRef}
                src={embedSrc}
                className="webview-element"
                style={{ width: '100%', height: '100%', border: 'none', opacity: isReady ? 1 : 0, transition: 'opacity 0.3s', zIndex: 1 }}
                allow="autoplay"
                onLoad={() => setIsReady(true)}
                onError={() => setNeedsVerification(true)}
              />
            )
          ) : null}
          <div className="click-overlay" onClick={togglePlay} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, cursor: 'pointer' }} />
        </div>
        
        <div className="bottom-controls-container" style={{ zIndex: 11 }}>
          <div className="floating-info">
            <div className="user-nickname">{video.user.nickname}</div>
            <div className="video-desc">{video.description}</div>
            <div className="music-tag">
              <Music size={14} /> {video.music}
            </div>
          </div>
          
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
                onChange={() => {}} /* Cannot seek iframe easily */
                onClick={(e) => e.stopPropagation()}
                className="progress-bar"
              />
            </div>
            <div className="volume-control">
              <div className="mute-btn" onClick={(e) => { e.stopPropagation(); onMuteChange(!globalMuted); }}>
                {globalMuted || globalVolume === 0 ? <VolumeX size={20} color="white" /> : <Volume2 size={20} color="white" />}
              </div>
            </div>
          </div>
        </div>
      </div>

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
