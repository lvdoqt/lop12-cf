# Lớp 12 LMS & hệ thống thi thử V-SAT

Nền tảng học tập và thi trực tuyến dành cho học sinh THPT, xây dựng bằng Astro, React, TypeScript và Supabase. Hệ thống có ngân hàng câu hỏi, đề thi thường, đề V-SAT, tài khoản học sinh/giáo viên/admin, lưu lượt thi và chấm điểm tự động.

## Tính năng V-SAT

- Kho đề riêng tại `/v-sat`.
- Phòng thi trên máy tính có đồng hồ, phiếu trả lời và tự nộp khi hết giờ.
- Hỗ trợ cấu trúc đề minh họa Toán và Tiếng Anh V-SAT 2025.
- Hỗ trợ Đúng/Sai, MCQ A–D, đọc hiểu theo nhóm, ghép hợp A–F, trả lời ngắn và điền một từ.
- Chấm điểm thô theo thang 150; lưu riêng `raw_score` và `ability_score`.
- Điểm năng lực hiển thị “Chưa hiệu chỉnh” cho đến khi có kết quả IRT hợp lệ.
- Xuất CSV kết quả V-SAT từ trang quản trị.

## Cài đặt nhanh

Yêu cầu Node.js từ 22.15 trở lên.

```bash
npm install
npm run dev
```

Ứng dụng chạy tại `http://localhost:4321`.

Các lệnh kiểm tra:

```bash
npm run build
npx astro check
npx tsc --noEmit
```

## Cấu hình môi trường

Tạo `.env` từ `.env.example` và điền thông tin Supabase:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Có thể dùng `PUBLIC_SUPABASE_URL` và `PUBLIC_SUPABASE_ANON_KEY`. Nếu khóa bị thiếu hoặc là placeholder, ứng dụng tự chạy Mock Mode. Không đưa service-role key vào frontend hoặc repository công khai.

## Cài đặt Supabase

### Database đã có LMS

Mở Supabase Dashboard → SQL Editor → New query, dán và chạy toàn bộ file:

[`supabase/VSAT_SETUP.sql`](supabase/VSAT_SETUP.sql)

File tổng hợp này có thể chạy lại an toàn và sẽ:

- Thêm `vsat` vào `exam_type`.
- Thêm `attempts.raw_score` và `attempts.ability_score`.
- Tạo index cho đề V-SAT, điểm thô và type câu hỏi JSONB.

### Database Supabase mới hoàn toàn

Chạy các file trong `supabase/migrations` theo thứ tự tên file. Migration V-SAT cuối cùng là `20260902000000_vsat_exam_type.sql`. Sau đó khởi động lại ứng dụng.

## Tài khoản Mock Mode

- Học sinh: `student@lop12.vn`
- Giáo viên: `teacher@lop12.vn`
- Admin: `admin@lop12.vn`

Các nút tài khoản mẫu xuất hiện tại `/login` khi Mock Mode hoạt động.

## Tạo đề V-SAT

1. Đăng nhập bằng giáo viên hoặc admin.
2. Mở `/admin/v-sat/new`.
3. Nhập tên đề, môn, thời gian và mật khẩu nếu cần.
4. Dán JSON hoặc tải file mẫu ngay trên trang.
5. Nhấn “Tạo đề và xem trước”.
6. Đề xuất hiện tại `/v-sat`.

Thời gian theo đề minh họa 2025:

- Toán và Ngữ văn: 90 phút.
- Tiếng Anh, Vật lí, Hóa học, Sinh học, Lịch sử và Địa lí: 60 phút.

## File JSON mẫu

- [`public/vsat-mau-toan.json`](public/vsat-mau-toan.json): Đúng/Sai, MCQ theo ngữ liệu, ghép hợp và trả lời ngắn.
- [`public/vsat-mau-tieng-anh.json`](public/vsat-mau-tieng-anh.json): Đúng/Sai theo thông báo, đọc hiểu, ghép hợp và điền một từ.
- [`public/vsat-tieng-anh-2025-day-du.json`](public/vsat-tieng-anh-2025-day-du.json): Toàn bộ đề minh họa Tiếng Anh 2025, import trực tiếp, đủ 25 câu/85 tiểu mục/150 điểm.

Cấu trúc gốc:

```json
{
  "questions": [
    {
      "type": "msq",
      "content": "Nội dung câu hỏi",
      "statements": []
    }
  ]
}
```

| Type | Công dụng |
|---|---|
| `msq` | Một câu gồm các tiểu mục Đúng/Sai |
| `single_choice` | Một câu chọn A–D |
| `read` | Một ngữ liệu có nhiều câu A–D |
| `matching` | Ghép 4 nội dung với phương án A–F |
| `sa` | Trả lời ngắn |
| `cloze_text` | Điền một từ vào từng chỗ trống |

Nội dung hỗ trợ Markdown, HTML cơ bản, ảnh từ URL và LaTeX trong `$...$` hoặc `$$...$$`.

## Cách chấm V-SAT

Điểm thô tối đa là 150:

- Đúng/Sai: đúng 1/4 ý được 1 điểm; 2/4 được 2; 3/4 được 3; 4/4 được 6.
- Ghép hợp: mỗi tiểu mục đúng được 1,5 điểm.
- MCQ A–D: mỗi câu đúng được 6 điểm.
- Trả lời ngắn hoặc điền một từ: mỗi câu/ô đúng được 6 điểm.

Điểm năng lực phải được ước lượng bằng IRT với tham số câu hỏi đã hiệu chỉnh và dữ liệu mẫu thí sinh. Hệ thống không quy đổi tuyến tính điểm thô; `ability_score` để trống đến khi có kết quả IRT.

## Quy trình học sinh

1. Mở `/v-sat`, chọn đề và vào phòng thi.
2. Đăng nhập nếu được yêu cầu.
3. Làm bài, theo dõi đồng hồ và phiếu trả lời.
4. Nhấn “Nộp bài” hoặc để hệ thống tự nộp khi hết giờ.
5. Xem điểm thô, đáp án và lời giải.

## Quy trình giáo viên

- Tạo đề: `/admin/v-sat/new`.
- Quản lý đề: `/admin/exams`.
- Kho đề: `/v-sat`.
- Xem lượt thi và tải CSV từ trang chi tiết đề trong quản trị.

## Kiến trúc V-SAT

```text
src/pages/v-sat.astro                 Kho đề V-SAT
src/pages/admin/v-sat/new.astro       Tạo đề từ JSON
src/components/VSatExamView.tsx       Giao diện phòng thi
src/components/MatchingQuestion.tsx   Câu ghép hợp
src/components/ClozeTextQuestion.tsx  Câu điền một từ
src/pages/api/attempts.ts              Chấm và lưu kết quả
supabase/VSAT_SETUP.sql                SQL nâng cấp một lần
public/vsat-mau-*.json                 JSON mẫu
```

## Lưu ý vận hành

- Đề phải có `exam_type = 'vsat'` để dùng giao diện và thang 150.
- Mỗi câu `msq` và `matching` nên có đúng 4 tiểu mục.
- Với `cloze_text`, dùng `accepted_answers` khi có nhiều cách viết đúng.
- Không đổi khóa ghép sau khi đã có học sinh nộp bài.
- Chạy `npm run build` trước khi triển khai.

## Triển khai

Dự án dùng Astro SSR và adapter Cloudflare. Khai báo các biến môi trường Supabase trên nền tảng triển khai rồi chạy:

```bash
npm run build
```
