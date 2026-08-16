import * as readline from 'readline';
import { loadConfig } from './config';
import { GoogleSheetsAdapter } from './adapters/google-sheets/adapter';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const tabs = [
  { id: 1, name: 'Mới Nhất (Trang chủ)', url: 'https://xnhau.pics/' },
  { id: 2, name: 'Hot Nhất', url: 'https://xnhau.pics/clip-sex-hot/' },
  { id: 3, name: 'Hay Nhất', url: 'https://xnhau.pics/clip-sex-hay/' },
  { id: 4, name: 'Dài Nhất', url: 'https://xnhau.pics/top-rated/?sort_by=duration' },
  { id: 5, name: 'Bình luận nhiều nhất', url: 'https://xnhau.pics/top-rated/?sort_by=most_commented' },
  { id: 6, name: 'Được yêu thích nhất', url: 'https://xnhau.pics/top-rated/?sort_by=most_favourited' }
];

async function startInteractiveCrawler() {
  console.log('\n===================================');
  console.log('  CHỌN NGUỒN CRAWL TỪ XNHAU');
  console.log('===================================');
  
  tabs.forEach(tab => {
    console.log(`${tab.id}. ${tab.name}`);
  });
  
  rl.question('\nNhập số (1-6) để chọn tab cần crawl: ', async (answer) => {
    const choice = parseInt(answer.trim());
    const selectedTab = tabs.find(t => t.id === choice);
    
    if (!selectedTab) {
      console.log('❌ Lựa chọn không hợp lệ. Vui lòng chạy lại và chọn từ 1 đến 6.');
      rl.close();
      process.exit(1);
    }
    
    console.log(`\n✅ Bạn đã chọn: ${selectedTab.name}`);
    console.log(`🔗 Target URL: ${selectedTab.url}\n`);
    
    console.log('Đang kết nối Google Sheets để cập nhật nguồn...');
    const config = loadConfig();
    const db = new GoogleSheetsAdapter(config.sheets.spreadsheetId);
    
    try {
      await db.connect();
      
      // Update seed page
      await db.createPage({
        url: selectedTab.url,
        priority: 'high'
      });
      console.log('✅ Đã cập nhật xong nguồn crawl!');
      await db.disconnect();
      
      console.log('🚀 Bắt đầu quá trình Crawl...\n');
      
      // Import and run the main crawler function from index.ts
      require('./index');
      
    } catch (err) {
      console.error('Lỗi khi cập nhật Google Sheets:', err);
      process.exit(1);
    }
    
    rl.close();
  });
}

startInteractiveCrawler();
