import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ngocminhtran426_db_user:cTezqk6ZENFJJu39@cluster0.dkjy0jm.mongodb.net/?appName=Cluster0';

// Define Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  role: { type: String, default: 'USER' },
  avatar_url: { type: String },
  created_at: { type: Date, default: Date.now }
});

const watchHistorySchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  video_id: { type: String, required: true },
  viewed_at: { type: Date, default: Date.now }
});

const videoSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  thumb_url: { type: String, required: true },
  file_url: { type: String, required: true },
  description: { type: String },
  music: { type: String, default: 'Original sound' },
  likes_count: { type: Number, default: 0 },
  comments_count: { type: Number, default: 0 },
  shares_count: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

// Ensure uniqueness per user-video
watchHistorySchema.index({ user_id: 1, video_id: 1 }, { unique: true });

export const User = mongoose.model('User', userSchema);
export const WatchHistory = mongoose.model('WatchHistory', watchHistorySchema);
export const Video = mongoose.model('Video', videoSchema);

let isConnected = false;

export async function connectDb() {
  if (isConnected) return;
  
  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log('[DB] Connected to MongoDB Atlas');

    // Seed default admin
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('admin00', salt);
      await User.create({
        username: 'admin',
        password_hash: hash,
        role: 'ADMIN'
      });
      console.log('[DB] Seeded default admin user (admin/admin00)');
    }
  } catch (error) {
    console.error('[DB] MongoDB Connection Error:', error);
  }
}
