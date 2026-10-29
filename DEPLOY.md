# Đưa Phòng Lab ĐTCS 3D lên Vercel

Đây là trang tĩnh (HTML + JS + ảnh), **không cần bước build**. Thư mục gốc để deploy là chính thư mục `Mô phỏng 3D` này.

Các file được đưa lên:

| File | Vai trò |
|---|---|
| `index.html` | Trang chính (giao diện + mô phỏng 3D) |
| `nguyen-ly.js` | Bảng Nguyên lý (mạch tối giản, dạng sóng) |
| `dropdown.js` | Ô chọn tự vẽ |
| `textures.js` | Ảnh mặt các module (≈ 2 MB) |
| `so-do/*.png` | Sơ đồ mạch trong giáo trình |
| `vercel.json` | Cấu hình header, bộ nhớ đệm |

Thư viện three.js và font chữ được tải từ CDN (jsdelivr, Google Fonts), nên trang cần có mạng.

## Cách 1 – Vercel CLI (nhanh nhất)

```bash
npm i -g vercel
cd "Mô phỏng 3D"
vercel            # lần đầu: đăng nhập, tạo project
vercel --prod     # đưa lên bản chính thức
```

Khi CLI hỏi:

- **Project name**: đặt tên không dấu, chữ thường, ví dụ `phong-lab-dtcs-3d` (tên thư mục có dấu tiếng Việt không dùng được làm tên project).
- **In which directory is your code located?** `./`
- **Want to modify these settings?** `N` (không có build command, không có output directory).

## Cách 2 – Qua GitHub

1. Đưa thư mục lên một repo GitHub (có thể đặt cả thư mục `Mô phỏng 3D` trong repo).
2. Vào vercel.com → **Add New… → Project** → chọn repo.
3. **Framework Preset**: `Other`.
4. **Root Directory**: chọn thư mục chứa `index.html` (ví dụ `Mô phỏng 3D`).
5. Để trống **Build Command** và **Output Directory** → **Deploy**.

Mỗi lần push lên nhánh chính, Vercel tự deploy lại.

## Kiểm tra sau khi deploy

- Mở trang → hiện màn hình chọn chế độ, chọn bài, vào phòng lab thấy bàn và module 3D.
- Bấm **Sơ đồ** ở một bài (ví dụ 7.1.1a) → ảnh sơ đồ hiện ra (kiểm tra thư mục `so-do` đã lên đủ).
- Mở thử trên điện thoại: thanh công cụ nằm dưới đáy.
- Xem nhanh mạch mẫu: thêm `#demo=8.2.1` vào cuối địa chỉ.
