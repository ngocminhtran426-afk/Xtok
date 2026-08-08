// Cấu hình Crawler cho Website Công ty của bạn
// Bạn có thể tùy chỉnh các Selector CSS ở đây để bóc tách dữ liệu chuẩn xác

export const CrawlerConfig = {
  // Đường dẫn gốc của trang web chứa list video
  TARGET_URL: 'https://example.com/videos', 
  
  // Thời gian chờ tối đa khi fetch (ms)
  TIMEOUT: 30000,
  
  // Chờ trang render (mili-giây) dành cho các trang dùng React/Vue
  renderDelay: 2000,

  // [TÙY CHỌN] Hàm xử lý lại dữ liệu sau khi bóc tách (Ví dụ: biến link chi tiết thành link mã nhúng iframe)
  processItem: (item: any) => {
    // Nếu không phải là link video (ví dụ link members) thì bỏ qua
    if (!item.videoUrl || !item.videoUrl.includes('/video/')) {
      return null;
    }

    // Ví dụ với xNhau: Chuyển đổi link /video/123456/... thành ID nhận diện để không bị dính cứng tên miền
    const match = item.videoUrl.match(/\/video\/(\d+)/);
    if (match) {
      // Lưu dưới dạng định danh thay vì hardcode thẻ iframe chứa tên miền
      item.videoUrl = `xnhau:${match[1]}`;
    }
    return item;
  },
  
  // ==========================================
  // CẤU HÌNH CSS SELECTORS ĐỂ BÓC TÁCH DỮ LIỆU
  // ==========================================
  Selectors: {
    // Thẻ bọc ngoài cùng của một video item trong danh sách
    videoItem: '.item',
    
    // Lấy link chi tiết để hàm processItem ở trên biến thành mã nhúng iframe
    videoUrl: 'a', 
    videoUrlAttr: 'href',
    
    // Selector lấy URL ảnh Thumbnail
    thumbnailUrl: 'img.thumb',
    thumbnailUrlAttr: 'src',
    
    // Selector lấy Tiêu đề
    title: '.title',
    
    // Selector lấy tên người đăng (có thể chung với title nếu web ko có)
    authorName: 'strong.title',
    
    // Selector lấy Avatar người đăng
    authorAvatar: 'img.thumb', 
    authorAvatarAttr: 'data-original', // Tạm lấy thumbnail làm avatar nếu ko có
    
    // Lượt xem, like, comment (nếu có)
    viewsCount: '.views',
    likesCount: '.likes',
    commentsCount: '.comments',

    // Trang tiếp theo
    nextPage: '.pagination .next a',
    nextPageAttr: 'href'
  }
};
