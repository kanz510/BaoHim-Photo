# PHOTO BEAUTY STUDIO

Studio chỉnh ảnh thủ công, ưu tiên offline, phát triển trên miniPaint đã pin. Giao diện tiếng Việt, màu hồng bụi/kem và bố cục desktop cùng thanh công cụ dưới cho iPhone. Không AI, video, upload ảnh hoặc API trả phí.

## Chạy

Node 24 LTS, npm 11. Checkout này là project riêng; không cần sửa repository khác.

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run check
npx http-server dist -p 4173
```

Mở `http://localhost:4173`; PWA cần HTTPS hoặc localhost. Các tài nguyên dùng local sau build. `npm run build` tạo `dist/` và Service Worker; không dùng `index.html` gốc làm static root.

## Công cụ

- Cắt/tỉ lệ, xoay/lật, đổi kích thước, phối cảnh hai trục, histogram, chỉnh sáng/màu, levels, curve, sắc nét, hạt film và 9 preset.
- Cọ làm mịn, sáng da, clone, dodge/burn, trang điểm có hòa trộn, vẽ/tẩy/khôi phục; warp/pinch/bulge, bảo vệ nền, khôi phục vùng, điểm eo/chân do người dùng đặt.
- Native layer: chọn/di chuyển/scale/rotate, thứ tự/ẩn/opacity/blend/nhân bản/gộp; chữ có font/màu/viền/giãn chữ/giãn dòng/độ cong/bóng; sticker, template và collage có frame thay ảnh riêng.
- Undo/redo chung; so sánh nguồn; autosave IndexedDB; mở/tải file `.pbs.json`; xuất JPEG/PNG/WebP. Giữ file dự án riêng vì thiết bị có thể xóa bộ nhớ trình duyệt.

Phím tắt: Ctrl/Cmd Z, Shift Z/Y, S để tải dự án, O để mở ảnh, `\` để so sánh; Space + kéo để di chuyển; Ctrl/Cmd + wheel để zoom. Cọ clone chọn nguồn trước bằng nút hoặc Alt + chạm. Hai ngón pan/zoom. Công cụ Vẽ & xóa nằm trong Cắt & xoay.

## Kiểm chứng và giới hạn

Đọc [kết quả kiểm chứng](docs/device-results.md) trước khi gọi đây là bản phát hành chính thức. Test DOM/pixel không thay thế Safari thật. Bản này giới hạn xuất 12,5 MP, chưa xác nhận hiệu năng iPhone, 48 MP, P3/HDR/RAW hay toàn bộ hành vi IME/VoiceOver.

[Kiến trúc](docs/architecture-decision.md) · [Nghiên cứu 9 nguồn và kế hoạch](docs/implementation-plan.md) · [Đăng ký nguồn](docs/source-register.json) · [Giấy phép](licenses.html) · [Notice đầy đủ](THIRD_PARTY_NOTICES.txt).

Code mới theo MIT; giữ nguyên notice miniPaint và thư viện bên thứ ba. Font theo OFL; ảnh mẫu theo Unsplash License; sticker/template hình học do project tạo. Không dùng tài nguyên hoặc thương hiệu độc quyền Meitu.
