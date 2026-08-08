import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import VideoCard from './VideoCard';
import { ChevronUp, ChevronDown } from 'lucide-react';

const VideoFeed = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const feedRef = useRef(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await axios.get('/api/videos');
        const shuffled = response.data.data.sort(() => Math.random() - 0.5);
        setVideos(shuffled);
      } catch (error) {
        console.error("Failed to fetch videos:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchVideos();
  }, []);

  const smoothScrollTo = (container, targetTop) => {
    // Tạm thời tắt scroll-snap để tránh lỗi nhảy cóc của Chrome
    container.style.scrollSnapType = 'none';
    
    const startTop = container.scrollTop;
    const distance = targetTop - startTop;
    const duration = 400; // 400ms duration
    let startTime = null;

    const animation = (currentTime) => {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      
      // Hiệu ứng easeInOutQuad mượt mà
      const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
      
      container.scrollTop = startTop + distance * ease;

      if (timeElapsed < duration) {
        requestAnimationFrame(animation);
      } else {
        // Bật lại scroll-snap sau khi cuộn xong
        container.style.scrollSnapType = 'y mandatory';
      }
    };

    requestAnimationFrame(animation);
  };

  const scrollUp = () => {
    if (feedRef.current) {
      const container = feedRef.current;
      const height = container.clientHeight;
      const target = Math.max(0, container.scrollTop - height);
      smoothScrollTo(container, target);
    }
  };

  const scrollDown = () => {
    if (feedRef.current) {
      const container = feedRef.current;
      const height = container.clientHeight;
      const target = container.scrollTop + height;
      smoothScrollTo(container, target);
    }
  };

  if (loading) {
    return <div className="video-feed" style={{ justifyContent: 'center', fontSize: 24 }}>Đang tải...</div>;
  }

  return (
    <main className="video-feed" ref={feedRef}>
      {videos.map((video, idx) => (
        <VideoCard key={idx} video={video} />
      ))}
      
      {/* Floating Navigation Buttons */}
      <div className="nav-buttons">
        <button className="nav-btn" onClick={scrollUp}><ChevronUp size={28} color="white" /></button>
        <button className="nav-btn" onClick={scrollDown}><ChevronDown size={28} color="white" /></button>
      </div>

      {/* Skeleton for loading more */}
      <div style={{ height: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: 30, height: 30, border: '3px solid var(--primary-color)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </main>
  );
};

export default VideoFeed;
