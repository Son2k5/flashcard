# 🌿 Lá — Flashcard & Quiz Thử Thách

> Ứng dụng web học từ vựng và luyện trắc nghiệm tĩnh (Single-page App), hoạt động 100% trên trình duyệt, không cần backend, không cần cài đặt phức tạp.

---

## 🚀 Giới thiệu & Tính năng chính

**Lá** là công cụ hỗ trợ ghi nhớ từ vựng đa ngôn ngữ và ôn luyện trắc nghiệm mọi môn học dành cho cá nhân hoặc nhóm bạn:

### 1. 🗂️ Học Flashcard thông minh
- **Thẻ 3D trực quan**: Lật thẻ mượt mà, hỗ trợ phím tắt (`Space` lật, `←` chưa thuộc, `→` đã thuộc).
- **Phân nhóm khoa học**: Học theo từng Chapter / Section, có tính năng gộp hoặc tách nhóm linh hoạt.
- **Ôn tập lặp lại**: Tự động đưa thẻ chưa thuộc quay lại trong phiên học; lọc danh sách từ khó gắn sao ⭐.
- **Phát âm từ vựng**: Tích hợp giọng đọc bản xứ đa ngôn ngữ (Anh, Nhật, Hàn, Trung, Pháp,...).

### 2. ⚡ Quiz thử thách & Đua top
- **Đa dạng chế độ**: Trắc nghiệm 4 đáp án hoặc gõ từ chính xác; hỗ trợ hẹn giờ (10s, 15s, 20s, 30s) hoặc không giới hạn.
- **Cơ chế tính điểm & combo**: Điểm thưởng theo tốc độ trả lời và chuỗi liên hoàn đúng (Streak multiplier).
- **Power-ups trợ lực**: Nhận quà hỗ trợ khi đạt chuỗi đúng (**50/50**, **Thêm giờ**, **Nhân đôi điểm**, **Cơ hội thứ hai**).
- **Thi đấu cùng Bot ảo**: 4 cấp độ đối thủ ảo (Mầm, Mây, Cáo, Sao) mô phỏng thời gian thực.
- **Chế độ lặp câu sai**: Tự động lặp lại các câu trả lời sai cho đến khi chọn đúng.

### 3. 📄 Nhập liệu tự động từ Word & PDF
- **Nhập từ vựng (`.docx`)**: Tự động nhận diện bảng từ, tách Chapter/Section theo Heading, bóc tách từ loại và ghi chú.
- **Nhập đề trắc nghiệm (`.docx` & `.pdf`)**: Tự động bóc tách câu hỏi, 4 phương án A/B/C/D và đáp án đúng (in đậm).

### 4. 🔒 Riêng tư & Quản lý dữ liệu
- **100% Client-side**: Xử lý tài liệu và lưu trữ toàn bộ dữ liệu trên thiết bị người dùng (`localStorage`), không gửi dữ liệu lên máy chủ.
- **Sao lưu & Phục hồi**: Dễ dàng xuất/nhập toàn bộ tiến độ học tập qua file JSON.
- **Quản lý bộ nhớ**: Báo cáo dung lượng trực quan, cảnh báo bộ nhớ đầy, hỗ trợ dọn dẹp dữ liệu rác.
- **Cổng bảo vệ (Access Gate)**: Khóa truy cập bằng mã nhẹ nhàng cho nhóm học thông qua mã băm SHA-256.

---

## 🛠️ Công nghệ sử dụng

Ứng dụng được thiết kế theo triết lý **tinh gọn, độc lập và tối ưu tốc độ**:

- **Kiến trúc Single File**:
  - Toàn bộ giao diện, hiệu ứng và logic ứng dụng nằm trọn vẹn trong file [`index.html`](index.html).
  - Không dùng frontend framework (No React/Vue/Angular), không cần build tool/bundler (No Webpack/Vite).
- **Thư viện xử lý tài liệu (Local Vendor)**:
  - **Mammoth.js (v1.13.0)**: Trích xuất nội dung từ file Word (`.docx`).
  - **PDF.js (v6.4.299)**: Đọc và trích xuất text từ file PDF.
  - *Tất cả thư viện được lưu sẵn trong thư mục `vendor/`, hoạt động offline không phụ thuộc CDN.*
- **Web APIs hiện đại**:
  - **Web Storage (localStorage)**: Lưu trữ tiến độ theo Schema v3 phân tách dữ liệu tối ưu.
  - **Web Speech API**: Tổng hợp giọng đọc phát âm từ vựng.
  - **Web Audio API**: Tự tạo hiệu ứng âm thanh quiz trực tiếp từ sóng âm (không cần tải file mp3).
  - **Web Crypto API**: Xác thực mã truy cập bảo mật qua thuật toán SHA-256.
- **Kiểm thử (Testing)**:
  - Sử dụng **Playwright** và **linkedom** trong Node.js để chạy automated test cho parser và storage.

---

## 💻 Hướng dẫn cài đặt & Cách chạy

### 1. Chạy trên máy cá nhân (Local)
Vì là ứng dụng web tĩnh, bạn chỉ cần một static file server:

```powershell
# Chạy nhanh bằng npx serve:
npx --yes serve@14.2.4 . -l 4173
```
Sau đó truy cập: `http://localhost:4173`

*(Bạn cũng có thể dùng Live Server trên VS Code hoặc lệnh `python -m http.server 4173`)*.

### 2. Đổi mã truy cập nhóm (Tùy chọn)
Nếu muốn đổi mật mã truy cập ứng dụng:

```powershell
node scripts/set-access-code.cjs
```
Nhập mã mới (8–200 ký tự). Script sẽ tự động cập nhật mã hash SHA-256 vào `index.html`.

### 3. Chạy kiểm thử (Tests)
```powershell
# Cài đặt dependency phục vụ test:
npm ci

# Chạy test logic và lưu trữ:
npm test

# Chạy test nhập quiz trên trình duyệt thực tế:
npm run test:quiz-browser
```

### 4. Triển khai (Deploy)
Bạn có thể host ứng dụng trên bất kỳ nền tảng tĩnh nào (Vercel, Cloudflare Pages, GitHub Pages,...):
- **Triển khai lên Vercel**:
  - Dự án đã có sẵn file [`vercel.json`](vercel.json) với đầy đủ cấu hình bảo mật CSP (Content Security Policy) và clean URLs.
  - Build command: *để trống*.
  - Output directory: `.`
  - *Lưu ý: Luôn tải lên cả thư mục `vendor/` cùng với `index.html`.*

---

## 📁 Cấu trúc thư mục

```text
├── index.html        # Toàn bộ ứng dụng (HTML, CSS, JS)
├── vendor/           # Thư viện đọc Word/PDF đóng gói sẵn (Mammoth, PDF.js)
├── scripts/          # Script tiện ích (đổi mã truy cập)
├── tests/            # Bộ unit test & browser test
├── package.json      # Khai báo dependency cho môi trường test
└── vercel.json       # Cấu hình header bảo mật & CSP cho Vercel
```
