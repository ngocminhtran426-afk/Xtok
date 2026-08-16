import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import VideoCard from './VideoCard';
import { ChevronUp, ChevronDown } from 'lucide-react';

const VideoFeed = ({ activeTab }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const feedRef = useRef(null);

  useEffect(() => {
    // Reset state when tab changes
    setVideos([]);
    setPage(1);
    setHasMore(true);
    setLoading(true);
    fetchVideos(1, activeTab, true);
  }, [activeTab]);

  const fetchVideos = async (pageNum, tabStr, isReset = false) => {
    if (!isReset && !hasMore) return;
    try {
      const response = await axios.get(`/api/videos?page=${pageNum}&tab=${tabStr}`);
      const newVideos = response.data.data;
      if (newVideos.length === 0) {
        setHasMore(false);
      } else {
        const shuffled = newVideos.sort(() => Math.random() - 0.5);
        setVideos(prev => isReset ? shuffled : [...prev, ...shuffled]);
      }
    } catch (error) {
      console.error("Failed to fetch videos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 200 && !loading && hasMore) {
      setLoading(true);
      const nextPage = page + 1;
      setPage(nextPage);
      fetchVideos(nextPage, activeTab);
    }
  };

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

  if (loading && videos.length === 0) {
    return <div className="video-feed" style={{ justifyContent: 'center', fontSize: 24 }}>Đang tải...</div>;
  }

  return (
    <main className="video-feed" ref={feedRef} onScroll={handleScroll}>
      {videos.map((video, idx) => (
        <VideoCard key={idx} video={video} />
      ))}
      
      {/* Floating Navigation Buttons */}
      <div className="nav-buttons">
        <button className="nav-btn" onClick={scrollUp}><ChevronUp size={28} color="white" /></button>
        <button className="nav-btn" onClick={scrollDown}><ChevronDown size={28} color="white" /></button>
      </div>

      {/* Skeleton for loading more */}
      {hasMore && (
        <div style={{ height: 100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ width: 30, height: 30, border: '3px solid var(--primary-color)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
      )}
      {!hasMore && videos.length > 0 && (
        <div style={{ height: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#666', fontSize: 14 }}>
          Bạn đã xem hết video!
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </main>
  );
};

export default VideoFeed;
