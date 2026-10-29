# Đưa Phòng Lab ĐTCS 3D lên Vercel

Đây là trang tĩnh (HTML + CSS + JS + ảnh), **không cần bước build**. Thư mục gốc để deploy là thư mục gốc của repo (nơi có `index.html`).

Các file được đưa lên:

| File | Vai trò |
|---|---|
| `index.html` | Trang chính (giao diện + mô phỏng 3D) |
| `css/style.css` | Giao diện |
| `js/nguyen-ly.js` | Bảng Nguyên lý (mạch tối giản, dạng sóng) |
| `js/dropdown.js` | Ô chọn tự vẽ |
| `assets/textures.js` | Ảnh mặt các module (≈ 2 MB) |
| `assets/schematics/*.png` | Sơ đồ mạch trong giáo trình |
| `vercel.json` | Cấu hình header, bộ nhớ đệm |

Thư mục `docs/`, `README.md` và các file cấu hình git được bỏ qua khi deploy (xem `.vercelignore`).

Thư viện three.js và font chữ được tải từ CDN (jsdelivr, Google Fonts), nên trang cần có mạng.

## Cách 1 – Vercel CLI (nhanh nhất)

```bash
npm i -g vercel
cd <thư-mục-repo>
vercel            # lần đầu: đăng nhập, tạo project
vercel --prod     # đưa lên bản chính thức
```

Khi CLI hỏi:

- **Project name**: đặt tên không dấu, chữ thường, ví dụ `phong-lab-dtcs-3d` (tên có dấu tiếng Việt không dùng được làm tên project).
- **In which directory is your code located?** `./`
- **Want to modify these settings?** `N` (không có build command, không có output directory).

## Cách 2 – Qua GitHub

1. Đẩy repo lên GitHub.
2. Vào vercel.com → **Add New… → Project** → chọn repo.
3. **Framework Preset**: `Other`.
4. **Root Directory**: để mặc định `./` (thư mục chứa `index.html`).
5. Để trống **Build Command** và **Output Directory** → **Deploy**.

Mỗi lần push lên nhánh chính, Vercel tự deploy lại.

## Kiểm tra sau khi deploy

- Mở trang → hiện màn hình chọn chế độ, chọn bài, vào phòng lab thấy bàn và module 3D.
- Bấm **Sơ đồ** ở một bài (ví dụ 7.1.1a) → ảnh sơ đồ hiện ra (kiểm tra thư mục `assets/schematics` đã lên đủ).
- Mở thử trên điện thoại: thanh công cụ nằm dưới đáy.
- Xem nhanh mạch mẫu: thêm `#demo=8.2.1` vào cuối địa chỉ.
