# Premium V2 preview — kết quả và bàn giao

Ngày 12/11/2026 (Asia/Bangkok). Nhánh `preview/premium-v2` trên bản preview `9359270`; site chính vẫn ở `afc871367f6d62edbff3367fe23ee80e06c6548f` và không có thay đổi. Preview dùng Site hiện hữu `appgprj_6af4bf0fd63081919725ed5e77578ef4`, không tạo hay sửa repo khác.

## Phạm vi đã triển khai

- Home/editor V2 riêng; darkroom charcoal, sheet pearl/blush, dock SVG một dòng, safe area/visual viewport và nhập tiếng Việt kế thừa bản mobile.
- Bảng riêng cho từng công cụ. 24 preset tham số, thumbnail ảnh thật; IDB preferences riêng lưu màu cá nhân và thumbnail dự án; quản lý/xóa dự án.
- Makeup là native layer alpha riêng, recipe cọ lưu được; kế thừa geometry, warp/freeze/flip/perspective và clip của ảnh mẹ. Adapter bổ sung lớp màu vào cùng native command khi ghép ảnh. Không dùng engine thứ hai.
- Chữ gradient, 2 font OFL mới bên cạnh Manrope/Playfair; 4 kiểu chữ, arc/stroke/shadow/spacing. Khung mới dùng rectangle/native bundle có thể sửa, reset, resize/crop/rotate và undo.
- Timeline dùng native action history của phiên; không dựng undo stack thứ hai. File PBS version 1 giữ nguyên; gradient/makeup/frame là metadata tùy chọn.
- Không đổi công thức grade/warp. Chỉ mục vùng bỏ qua phép thử ngoài ảnh hưởng, vẫn cập nhật điểm qua từng bước và giữ thứ tự cũ. Grade có thể ghi cùng pixel buffer; canvas tạm được giải phóng sau khi dùng/xuất. Kiểm tham chiếu exact cho index và pixel.
- JS content hash và entry `v2.html` giúp vào V2 khi worker cũ còn cache index/bundle V1. Giữ offline precache và source/assets cùng origin.

## Chứng cứ

`npm run build`, `npm test`, `npm run check`; 95/95 tests trong lần chạy đầy đủ gần nhất. Bài QA riêng tạo/mở JPEG tổng hợp 48 MP, fit viewport và xuất JPG/PNG đúng 12 MP. Metrics tại `docs/qa/premium-v2-metrics.json`; script benchmark tái hiện `scripts/benchmark-v2.mjs`. Toàn văn kết quả và hạn chế được xuất trong `v2-report.html`.

Rà soát code chỉ đọc phát hiện và đã có regression cho: clip makeup lúc xuất collage; style frame bị đổi khi kéo slider sau restore/undo; frame khi rotate; snapshot xuất trộn kích thước/geometry; mốc history bị xóa bởi edit đang chờ; tạo mask/font bị trễ khi đổi tài liệu; navigation chọn nhầm mask; và mất lối xóa dự án. Review sau sửa không còn finding quan trọng ở những phần này.

## Chưa nghiệm thu

Môi trường không có CUA/browser được kết nối; không cài browser hay chạy preview server thay thế. Đã xem screenshot trang chủ tự động từ hệ thống Sites; sửa bóng nút kế thừa của native reset.css và giữ nút undo/redo disabled hiển thị. Chưa kiểm trực tiếp editor/viewport iPhone trong browser. Chưa đo Safari/PWA iPhone 16 Pro Max thật, VoiceOver, IME/HEIC/EXIF thực, eviction/context loss hoặc long-run nhiều lớp. CPU 100 warp vẫn nặng. Export cap vẫn 12 MP, ảnh mở tối đa 64 MP. Chuỗi undo không lưu qua phiên. Collage giữ semantics native: bố cục mới thay chữ/sticker/khung cũ, còn undo trong phiên. Không nhận là hoàn chỉnh mức production.

Chỉ xuất bản Site preview để người dùng duyệt. Không merge hoặc triển khai lên Site chính trước khi được duyệt.
