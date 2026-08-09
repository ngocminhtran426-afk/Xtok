import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { connectDb, User, WatchHistory } from './db';
import { GoogleSheetsAdapter } from './adapters/google-sheets/adapter';

// Helper: Seeded Random Female Vietnamese Name Generator
function generateFemaleProfile(seedStr: string) {
  const surnames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
  const middleNames = ["Thị", "Ngọc", "Thảo", "Thu", "Mai", "Thanh", "Bích", "Hồng", "Kim", "Lan", "Như", "Phương", "Quỳnh", "Thùy", "Tuyết", "Yến", "Diễm", "Kiều", "Minh", "Bảo", "Trúc", "Uyển", "Tú"];
  const givenNames = ["Anh", "Châm", "Dung", "Đan", "Giang", "Hà", "Hân", "Hoa", "Hương", "Hằng", "Khuê", "Lan", "Linh", "Ly", "Mai", "Nga", "Ngọc", "Nhi", "Nhung", "Oanh", "Quyên", "Tâm", "Thảo", "Thư", "Thủy", "Tiên", "Trâm", "Trang", "Trinh", "Tú", "Uyên", "Vân", "Vy", "Yến", "My", "Mi", "Diệp", "An", "Châu", "Mỹ", "My", "Trà", "Khánh", "Hân", "Đan"];
  const avatars = [
    "https://i.pravatar.cc/150?img=1", "https://i.pravatar.cc/150?img=5", "https://i.pravatar.cc/150?img=9",
    "https://i.pravatar.cc/150?img=10", "https://i.pravatar.cc/150?img=16", "https://i.pravatar.cc/150?img=20",
    "https://i.pravatar.cc/150?img=24", "https://i.pravatar.cc/150?img=26", "https://i.pravatar.cc/150?img=28",
    "https://i.pravatar.cc/150?img=30", "https://i.pravatar.cc/150?img=32", "https://i.pravatar.cc/150?img=34"
  ];

  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const random = (max: number) => {
    const x = Math.sin(hash++) * 10000;
    return Math.floor((x - Math.floor(x)) * max);
  };

  const surname = surnames[random(surnames.length)];
  const middleName = middleNames[random(middleNames.length)];
  const givenName = givenNames[random(givenNames.length)];
  
  return {
    nickname: `${surname} ${middleName} ${givenName}`,
    first_name: `${surname} ${middleName}`,
    last_name: givenName,
    avatar: `/api/avatar/${encodeURIComponent(seedStr)}`
  };
}

// Proxy avatar endpoint to avoid client-side rate limiting
const avatarCache = new Map<string, string>();
app.get('/api/avatar/:seed', async (req, res) => {
  try {
    const seed = req.params.seed;
    if (avatarCache.has(seed)) {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(avatarCache.get(seed));
    }
    
    const response = await fetch(`https://api.dicebear.com/10.x/clay/svg?seed=${encodeURIComponent(seed)}`);
    if (!response.ok) {
      throw new Error(`DiceBear API returned ${response.status}`);
    }
    const svg = await response.text();
    avatarCache.set(seed, svg);
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (error) {
    console.error('[API] Avatar proxy error:', error);
    res.status(500).send('Error generating avatar');
  }
});

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

// Configure multer for avatar uploads (using memory storage for cloud upload)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Initialize Google Sheets Adapter directly
const GOOGLE_SHEETS_SPREADSHEET_ID = '13CXE7Z_Trz05WdT9Fy_usqyhen18sx46Lv4RorfLYlU';

// Decode obfuscated credentials for deployment
if (fs.existsSync(path.join(process.cwd(), 'credentials.b64'))) {
  fs.writeFileSync(path.join(process.cwd(), 'credentials.json'), Buffer.from(fs.readFileSync(path.join(process.cwd(), 'credentials.b64'), 'utf-8'), 'base64'));
}
if (fs.existsSync(path.join(process.cwd(), 'token.b64'))) {
  fs.writeFileSync(path.join(process.cwd(), 'token.json'), Buffer.from(fs.readFileSync(path.join(process.cwd(), 'token.b64'), 'utf-8'), 'base64'));
}

const db = new GoogleSheetsAdapter(GOOGLE_SHEETS_SPREADSHEET_ID);

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
      if (lastFetchTime > 0) {
        await (db as any).refreshCache(); // Force adapter to pull fresh data from sheet
      }
      const { items } = await db.findVideos({ limit: 100 });
      
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
          id: parseInt(v.id) || 1,
          ...generateFemaleProfile(String(v.id || 'crawler')),
          tick: true,
          bio: 'Vietnamese Creator',
          followers_count: Math.floor(Math.random() * 50000) + 1000,
          likes_count: Math.floor(Math.random() * 500000) + 5000
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
      const { items } = await db.findVideos({ limit: 100 });
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
        user: { id: parseInt(v.id) || 1, ...generateFemaleProfile(String(v.id || 'crawler')), tick: true, bio: 'Vietnamese Creator', followers_count: 9999, likes_count: 99999 }
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
app.get('/api/ping-db', async (req, res) => {
  try {
    const mongooseState = mongoose.connection.readyState;
    let sheetCount = -1;
    try {
      const { items } = await db.findVideos({ limit: 100 });
      sheetCount = items.length;
    } catch(e) {
      sheetCount = -2;
    }
    res.json({
      mongooseState,
      stateMap: { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' },
      sheetCount,
      cachedCount: cachedVideos.length
    });
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
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
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No image provided' });

    // Thay vì dùng Catbox (bị block IP trên Render), ta lưu trực tiếp Base64 vào MongoDB
    // File ảnh đại diện thường nhỏ nên lưu Base64 hoàn toàn khả thi và an toàn nhất
    const base64Data = file.buffer.toString('base64');
    const avatar_url = `data:${file.mimetype};base64,${base64Data}`;
    
    // Update user in MongoDB
    const userId = (req as any).user.id;
    await User.findByIdAndUpdate(userId, { avatar_url });

    res.json({ success: true, avatar_url });
  } catch (error) {
    console.error('[API] Error uploading avatar:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Serve frontend static files
const frontendDistPath = path.join(__dirname, '../../web/dist');
app.use(express.static(frontendDistPath));

// Fallback to index.html for React Router
app.use((req, res) => {
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
    
    await db.connect();
    console.log(`[API] Connected to Google Sheets`);
    
    // Initial fetch to prime the cache
    const { items } = await db.findVideos({ limit: 100 });
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
        id: parseInt(v.id) || 1,
        ...generateFemaleProfile(String(v.id || 'crawler')),
        tick: true,
        bio: 'Vietnamese Creator',
        followers_count: Math.floor(Math.random() * 50000) + 1000,
        likes_count: Math.floor(Math.random() * 500000) + 5000
      }
    }));
    lastFetchTime = Date.now();
    console.log(`[API] Cache primed with ${items.length} videos`);
  } catch (error) {
    console.error(`[API] Failed to connect to DB or Sheets:`, error);
  }
});
