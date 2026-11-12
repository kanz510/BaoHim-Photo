# PHOTO BEAUTY STUDIO PRO V2

Bản mã nguồn để đưa lên GitHub, xuất từ release `4d12c126928df9672828b0996208d5d053ada0da`.
Ứng dụng chỉnh ảnh thủ công, ưu tiên offline, dùng miniPaint và native layer/history.
Không AI, không video, không API chỉnh ảnh trả phí.

## Cài và chạy

Cần **Node.js 24 LTS**, npm 11 và Git. Lần cài đầu cần mạng để tải dependency mã nguồn mở.

```sh
npm ci --ignore-scripts
npm run build
npm run check
npm test
```

Build tạo thư mục `dist/` từ đầu. Dùng một HTTP server để mở `dist/`, ví dụ nếu đã có Python:

```sh
python3 -m http.server 4173 --directory dist
```

Mở `http://localhost:4173`. Không mở `index.html` trực tiếp bằng `file://`.
PWA/Service Worker cần HTTPS hoặc localhost. Khi triển khai static hosting, chọn `dist/` làm thư mục xuất bản.
Mã nguồn này không cần tài khoản hoặc project ID của ChatGPT Sites để build/chạy.

## Đưa lên GitHub

Giải nén ZIP; mở thư mục chứa `package.json`. Upload **nội dung bên trong** lên repository mới,
không chỉ upload nguyên file ZIP nếu bạn muốn repository chứa mã nguồn.
Giữ cả `.gitignore`, `.gitattributes` và `.babelrc`.

Hoặc dùng Git trong một thư mục mới sau khi giải nén:

```sh
git init
git add .
git commit -m "Initial PHOTO BEAUTY STUDIO PRO V2 source"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Thay `YOUR-ACCOUNT/YOUR-REPOSITORY` bằng repository của bạn. Dùng repository mới hoặc một nhánh riêng
nếu bạn đã có dự án khác. Không cần force push.
`dist/`, `node_modules/` và thư mục làm việc tạm được bỏ qua trong Git.

## Có trong bản V2

- Home mobile và editor nền tối, fit ảnh, pinch/pan, dock cuộn, bottom sheet kéo, so sánh giữ, Undo/Redo.
- 34 công thức màu, HSL 8 dải, curve/levels, blur; lưu preset màu riêng.
- Cọ mịn/sáng/tông da, clone/heal chọn nguồn; Liquify, vùng bảo vệ và điểm mặt/vóc dáng do người dùng đặt.
- Trang điểm thủ công trên lớp alpha liên kết: môi, má, mắt, mày, highlight.
- Chữ cong, viền, gradient, bóng, glow, nổi khối giả 3D, bong bóng; font Việt/Trung/Nhật/Hàn.
- 24 sticker gốc, 7 collage layout, 7 template, 4 kiểu khung; các lớp vẫn sửa được.
- PBS v1, autosave IndexedDB, tối đa 12 mốc dự án dùng chung Blob theo SHA-256; xuất JPEG/PNG/WebP.
- Worker cho màu/HSL/Liquify/heal; CJK font tải/cached khi sử dụng.

## Kiểm thử và giới hạn

Release đã có **118 Node tests** và **20 luồng mobile Playwright/Chromium 440×956 DPR3** qua kiểm thử;
đã thử mở ảnh 48 MP và xuất JPG/PNG 12 MP. Đây không phải xác nhận trên iPhone/Safari vật lý.
Xem [kết quả](docs/pro-v2/results.md), [audit 9 nguồn](docs/pro-v2/audit.md),
[review](docs/pro-v2/review.md) và `v2-report.html` (có trong `dist/` sau build).
Undo thuộc phiên hiện tại; file PBS lưu trạng thái hiện tại, không đóng gói toàn bộ DB mốc lịch sử.
Dữ liệu ảnh/dự án cá nhân trong IndexedDB của người dùng không nằm trong gói mã nguồn này.

Phông CJK đã kèm file local, có thể cần tải lần đầu khi được chọn. Safe-area, bàn phím Việt,
HEIC/P3 và giới hạn bộ nhớ Safari trên thiết bị thật còn cần kiểm thử.
Figma là file thiết kế online; ZIP chứa thông tin tham chiếu trong `docs/pro-v2/figma-reference.json`,
không phải file `.fig`. Tình trạng media/quota Figma được ghi trong báo cáo.

## Cấu trúc và giấy phép

- `src/`: mã engine, UI mobile và pixel/worker pipeline.
- `assets/`: ảnh mẫu, font OFL, sticker và screenshot có nguồn gốc rõ ràng.
- `scripts/`, `tests/`: build, kiểm tra và kiểm thử.
- `docs/`: kiến trúc, nghiên cứu, kiểm thử và giới hạn.
- `HANDOFF.json`: commit gốc và các điều chỉnh đóng gói.
- `SOURCE_SHA256.json`: hash của từng file nguồn trong gói.

Code mới và miniPaint giữ giấy phép MIT; các thư viện giữ notice gốc.
Font theo OFL; ảnh mẫu theo Unsplash License. Giữ `MIT-LICENSE.txt`, `THIRD_PARTY_NOTICES.txt`
và `assets/licenses/` khi phân phối. Không sử dụng thương hiệu hay tài nguyên độc quyền Meitu.
