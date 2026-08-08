import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { connectDb, User, WatchHistory } from './db';

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-super-secret-key-2026';
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Setup static serving for uploads
const uploadsDir = path.join(__dirname, '../../uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

// --- MOCK VIDEOS FOR DEPLOYMENT ---
const MOCK_VIDEOS = [
  { id: '1', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', thumbnailUrl: 'https://images.unsplash.com/photo-1616469829581-73993eb86b02', title: 'Video 1', description: 'Hello world', likes: 100 },
  { id: '2', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', thumbnailUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113', title: 'Video 2', description: 'Testing render deployment', likes: 250 }
];

// --- AUTH MIDDLEWARE ---
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    (req as any).user = decoded;
    next();
  });
};

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if ((req as any).user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Admin only' });
  }
  next();
};

// Basic caching to avoid hitting rate limits
let cachedVideos: any[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

app.get('/api/videos', requireAuth, async (req, res) => {
  try {
    const now = Date.now();
    if (now - lastFetchTime > CACHE_TTL_MS || cachedVideos.length === 0) {
      const items = MOCK_VIDEOS;
      
      // Map to TikTok UI expected schema
      cachedVideos = items.map((v: any) => ({
        id: parseInt(v.id) || Math.random(),
        thumb_url: v.thumbnailUrl,
        file_url: v.videoUrl,
        description: v.description || v.title,
        music: 'Original sound - VideoPlatform',
        likes_count: v.likes || Math.floor(Math.random() * 10000),
        comments_count: Math.floor(Math.random() * 1000),
        shares_count: Math.floor(Math.random() * 500),
        meta: {
          video: {
            resolution_x: 720,
            resolution_y: 1280
          }
        },
        user: {
          id: 1,
          nickname: 'VideoCrawler',
          first_name: 'Video',
          last_name: 'Crawler',
          avatar: 'https://cdn-icons-png.flaticon.com/512/864/864685.png',
          tick: true,
          bio: 'Auto crawled videos',
          followers_count: 9999,
          likes_count: 99999
        }
      }));
      
      lastFetchTime = now;
      console.log(`[API] Refreshed cache from Google Sheets: ${items.length} videos`);
    }

    // Filter out seen videos
    const userId = (req as any).user.id;
    const seenRecords = await WatchHistory.find({ user_id: userId }).select('video_id');
    const seenSet = new Set(seenRecords.map(r => r.video_id));
    
    const feedVideos = cachedVideos.filter(v => !seenSet.has(String(v.id)));

    res.json({
      data: feedVideos,
      meta: {
        pagination: {
          total: feedVideos.length,
          count: feedVideos.length,
          per_page: 10,
          current_page: parseInt(req.query.page as string) || 1,
          total_pages: Math.ceil(feedVideos.length / 10)
        }
      }
    });
  } catch (error) {
    console.error('[API] Error fetching feed:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

app.get('/api/videos/resolve/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const mainDomain = 'https://xnhau.ink';
    const embedUrl = `${mainDomain}/embed/${id}`;
    
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const html = await response.text();
    const match = html.match(/https:\/\/[^"']*\.mp4/);
    
    if (match) {
      res.json({ url: match[0] });
    } else {
      res.status(404).json({ error: 'MP4 URL not found' });
    }
  } catch (error) {
    console.error('[API] Resolve error:', error);
    res.status(500).json({ error: 'Failed to resolve video' });
  }
});

// --- WATCH HISTORY ENDPOINTS ---
app.get('/api/videos/history', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    // Get history for the user, ordered by most recently viewed
    const history = await WatchHistory.find({ user_id: userId }).sort({ viewed_at: -1 }).limit(100);
    console.log(`[API] History requested by user ${userId}. Found ${history.length} records.`);
    
    if (history.length === 0) {
      return res.json([]);
    }
    
    // Ensure cache is populated
    if (cachedVideos.length === 0) {
      const items = MOCK_VIDEOS;
      cachedVideos = items.map((v: any) => ({
        id: parseInt(v.id) || Math.random(),
        thumb_url: v.thumbnailUrl,
        file_url: v.videoUrl,
        description: v.description || v.title,
        music: 'Original sound - VideoPlatform',
        likes_count: v.likes || Math.floor(Math.random() * 10000),
        comments_count: Math.floor(Math.random() * 1000),
        shares_count: Math.floor(Math.random() * 500),
        meta: { video: { resolution_x: 720, resolution_y: 1280 } },
        user: { id: 1, nickname: 'VideoCrawler', first_name: 'Video', last_name: 'Crawler', avatar: 'https://cdn-icons-png.flaticon.com/512/864/864685.png', tick: true, bio: 'Auto crawled videos', followers_count: 9999, likes_count: 99999 }
      }));
    }

    // Map the video_ids to the cached video objects
    const historyIds = history.map(h => String(h.video_id));
    const historyVideosMap = new Map();
    
    cachedVideos.forEach(v => {
      if (historyIds.includes(String(v.id))) {
        historyVideosMap.set(String(v.id), v);
      }
    });
    
    // Maintain the DESC order from watch_history
    const result = history
      .map(h => historyVideosMap.get(String(h.video_id)))
      .filter(v => v !== undefined);
      
    res.json(result);
  } catch (error) {
    console.error('[API] Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.post('/api/videos/seen', requireAuth, async (req, res) => {
  try {
    const { video_id } = req.body;
    if (!video_id) return res.status(400).json({ error: 'Missing video_id' });
    
    const userId = (req as any).user.id;
    
    await WatchHistory.updateOne(
      { user_id: userId, video_id: String(video_id) },
      { $setOnInsert: { user_id: userId, video_id: String(video_id) } },
      { upsert: true }
    );
    console.log(`[API] Marked video ${video_id} as seen by user ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error saving watch history:', error);
    res.status(500).json({ error: 'Failed to save watch history' });
  }
});

// --- AUTH ENDPOINTS ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, username: user.username, role: user.role, avatar_url: user.avatar_url }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, username: user.username, role: user.role, avatar_url: user.avatar_url } });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- USER MANAGEMENT ENDPOINTS ---
app.get('/api/users/top', requireAuth, async (req, res) => {
  try {
    const users = await User.find().sort({ _id: 1 }).limit(3).select('_id username avatar_url');
    res.json(users.map(u => ({ id: u._id, username: u.username, avatar_url: u.avatar_url })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch top users' });
  }
});

app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await User.find().select('_id username role avatar_url created_at');
  res.json(users.map(u => ({ id: u._id, username: u.username, role: u.role, avatar_url: u.avatar_url, created_at: u.created_at })));
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    await User.create({ username, password_hash: hash, role: role || 'USER' });
    res.status(201).json({ success: true });
  } catch (error: any) {
    if (error.code === 11000) return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { password, role } = req.body;
    const { id } = req.params;
    
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      await User.findByIdAndUpdate(id, { password_hash: hash, role });
    } else {
      await User.findByIdAndUpdate(id, { role });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Prevent deleting the main admin
    const user = await User.findById(req.params.id);
    if (user?.username === 'admin') return res.status(403).json({ error: 'Cannot delete main admin' });
    
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.post('/api/users/me/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  // Tạm thời vô hiệu hóa tính năng Upload Avatar theo yêu cầu
  return res.status(501).json({ error: 'Feature temporarily disabled for deployment' });
});

// Serve frontend static files
const frontendDistPath = path.join(__dirname, '../../web/dist');
app.use(express.static(frontendDistPath));

// Fallback to index.html for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

app.listen(port, async () => {
  console.log(`===================================`);
  console.log(`  Video Platform API Server`);
  console.log(`===================================`);
  console.log(`[API] Server listening on http://localhost:${port}`);
  
  try {
    await connectDb(); // Initialize MongoDB
    console.log(`[API] Connected to MongoDB`);
    
    // Initial fetch to prime the cache
    const items = MOCK_VIDEOS;
    cachedVideos = items.map(v => ({
      id: parseInt(v.id) || Math.random(),
      thumb_url: v.thumbnailUrl,
      file_url: v.videoUrl,
      description: v.description || v.title,
      music: 'Original sound - VideoPlatform',
      likes_count: v.likes || Math.floor(Math.random() * 10000),
      comments_count: Math.floor(Math.random() * 1000),
      shares_count: Math.floor(Math.random() * 500),
      meta: {
        video: {
          resolution_x: 720,
          resolution_y: 1280
        }
      },
      user: {
        id: 1,
        nickname: 'VideoCrawler',
        first_name: 'Video',
        last_name: 'Crawler',
        avatar: 'https://cdn-icons-png.flaticon.com/512/864/864685.png',
        tick: true,
        bio: 'Auto crawled videos',
        followers_count: 9999,
        likes_count: 99999
      }
    }));
    lastFetchTime = Date.now();
    console.log(`[API] Cache primed with ${items.length} videos`);
  } catch (error) {
    console.error(`[API] Failed to connect to DB:`, error);
  }
});
