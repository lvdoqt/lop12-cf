# 🎓 Lớp 12 LMS - Web App Học Tập & Ôn Thi Trắc Nghiệm Online

Nền tảng Quản lý Học tập (LMS) hoàn chỉnh dành cho học sinh THPT lớp 12 tại Việt Nam. Dự án được phát triển dựa trên các công nghệ hiện đại nhất: **Astro 6 (SSR)**, **Supabase Auth & Database**, **TailwindCSS (v4)** và **TypeScript**.

## ✨ Tính năng nổi bật

### 1. Học sinh Portal (ChatGPT/Gemini Style)
* **Giao diện hiện đại:** Thiết kế Responsive Mobile-First, hỗ trợ chế độ Dark Mode tinh tế mặc định, thanh Sidebar điều hướng thông minh.
* **Bài học đa phương tiện:** Tích hợp video bài giảng YouTube, nội dung tóm tắt lý thuyết bằng Markdown cực đẹp qua Tailwind Typography, hiển thị trực quan các công thức Toán, Lý, Hóa dưới dạng **LaTeX** (qua KaTeX). Hỗ trợ đính kèm tài liệu học tập PDF.
* **Thi trắc nghiệm có tính giờ:** Các bài kiểm tra 15 phút, 1 tiết, học kỳ và thi thử THPT Quốc gia. Đồng hồ đếm ngược tự động nộp bài khi hết giờ. Chấm điểm chính xác, hiển thị kết quả trực quan cùng lời giải chi tiết.
* **AI Hỗ Trợ Học Tập:** Cửa sổ chat AI thông minh (ChatGPT-like) sẵn sàng giải đáp mọi thắc mắc học tập, công thức và lý thuyết 24/7.
* **Bảng điều khiển & Thống kê:** Theo dõi điểm số trung bình (GPA), số lượng bài đã hoàn thành, hiển thị biểu đồ tiến độ học tập trực quan sử dụng **Chart.js**.

### 2. Giáo viên & Admin Portal (Hệ thống CRUD toàn diện)
* **Dashboard Admin:** Thống kê nhanh số học sinh, giáo viên, bài học, đề thi và tổng lượt làm bài thi trên nền tảng.
* **Quản lý người dùng:** Liệt kê danh sách tài khoản và phân quyền trực tiếp (Student, Teacher, Admin).
* **Quản lý bài giảng:** Soạn thảo, chỉnh sửa, xóa và xuất bản bài giảng với trình sinh slug tự động.
* **Ngân hàng câu hỏi:** Thêm mới và quản lý câu hỏi trắc nghiệm (hỗ trợ trắc nghiệm đơn, nhiều lựa chọn, Đúng/Sai), thiết lập đáp án đúng và viết lời giải chi tiết chứa LaTeX.
* **Quản lý đề thi:** Tạo đề thi mới, thiết lập thời gian làm bài (phút), phân loại đề thi, gán danh sách câu hỏi tương ứng tự động lọc theo môn học.

---

## 🛠️ Hướng dẫn cài đặt và chạy thử cục bộ (Local Setup)

Dự án này được thiết kế thông minh để có thể **chạy ngay lập tức** sau khi tải về mà không cần cấu hình database phức tạp nhờ cơ chế **Mock Mode (Chạy offline)** tự động kích hoạt khi phát hiện thông tin placeholder.

### Bước 1: Cài đặt thư viện
Chạy lệnh sau tại thư mục gốc của dự án để tải về các package:
```bash
npm install
```

### Bước 2: Chạy dự án ở chế độ phát triển
Khởi động máy chủ local:
```bash
npm run dev
```
Truy cập ứng dụng tại: `http://localhost:4321`

---

## 🗄️ Cấu hình Supabase Database (Chế độ Production)

Khi đã sẵn sàng chuyển từ chạy giả lập Mock sang kết nối cơ sở dữ liệu thật của bạn trên Supabase, hãy làm theo các bước sau:

### 1. Tạo Database Schema
Mở **SQL Editor** trên trang quản trị dự án Supabase của bạn, sao chép và chạy lần lượt nội dung của hai tệp tin SQL di chuyển (migrations) nằm trong thư mục của dự án:
1. [01_schema.sql](file:///d:/lop12/supabase/migrations/20260604000000_schema.sql): Tạo cấu trúc bảng, các khóa ngoại và thiết lập hàm/trigger tự động đồng bộ tài khoản người dùng từ `auth.users` sang `public.users`.
2. [02_rls_policies.sql](file:///d:/lop12/supabase/migrations/20260604000001_rls_policies.sql): Thiết lập chính sách bảo mật Row Level Security (RLS) để phân quyền: học sinh đọc bài/làm bài, chỉ giáo viên và admin mới có quyền CRUD nội dung học liệu.

### 2. Cập nhật các biến môi trường
Thay đổi các giá trị placeholder trong tệp tin `.env` ở thư mục gốc bằng thông tin kết nối thực tế từ Supabase Dashboard (Settings -> API):
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-private-service-role-key
GEMINI_API_KEY=your-gemini-api-key-if-using-ai
```
*Sau khi lưu file `.env`, hãy khởi động lại server (`npm run dev`) để áp dụng cấu hình thật.*

---

## 🔐 Tài khoản thử nghiệm (Mock Mode)

Khi chạy ở chế độ Mock Mode, bạn có thể đăng nhập bằng các tài khoản mẫu định sẵn hiển thị trực tiếp trên giao diện Đăng nhập:
* **Học sinh:** `student@lop12.vn` (Xem bài học, thi trắc nghiệm, chat AI, theo dõi biểu đồ).
* **Giáo viên:** `teacher@lop12.vn` (Toàn quyền quản trị bài học, ngân hàng câu hỏi, đề thi).
* **Admin:** `admin@lop12.vn` (Toàn quyền quản lý hệ thống, phân quyền người dùng).

---

## 🚀 Hướng dẫn triển khai dự án (Deployment Guide)

Astro 6 hỗ trợ biên dịch và deploy cực kỳ mượt mà lên nhiều nền tảng Cloud:

### 1. Cloudflare Pages
1. Thay thế adapter trong file `astro.config.mjs` bằng `@astrojs/cloudflare`:
   ```bash
   npm install @astrojs/cloudflare
   ```
   *Cấu hình trong `astro.config.mjs`:*
   ```javascript
   import cloudflare from '@astrojs/cloudflare';
   export default defineConfig({
     output: 'server',
     adapter: cloudflare()
   });
   ```
2. Đẩy code lên GitHub.
3. Liên kết dự án GitHub với Cloudflare Pages Dashboard. Chọn framework **Astro** và thiết lập các biến môi trường (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) trong phần cấu hình biến của Cloudflare.

### 2. Vercel
1. Cài đặt adapter Vercel:
   ```bash
   npm install @astrojs/vercel
   ```
   *Cấu hình trong `astro.config.mjs`:*
   ```javascript
   import vercel from '@astrojs/vercel';
   export default defineConfig({
     output: 'server',
     adapter: vercel()
   });
   ```
2. Đẩy code lên GitHub và nhập dự án vào Vercel Dashboard. Vercel sẽ tự động nhận diện Astro và build dự án SSR. Đừng quên dán các biến môi trường vào phần settings của Vercel.

### 3. Netlify
1. Cài đặt adapter Netlify:
   ```bash
   npm install @astrojs/netlify
   ```
   *Cấu hình trong `astro.config.mjs`:*
   ```javascript
   import netlify from '@astrojs/netlify';
   export default defineConfig({
     output: 'server',
     adapter: netlify()
   });
   ```
2. Kết nối GitHub với Netlify Dashboard để kích hoạt tính năng tự động build và deploy liên tục (CI/CD). Khai báo các thông số kết nối Supabase trong phần Environment Variables.
