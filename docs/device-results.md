# Kết quả kiểm chứng

Môi trường: Linux, Node 24, production Webpack; kiểm thử DOM bằng jsdom và pixel bằng Skia qua `@napi-rs/canvas`. Đây không phải kiểm thử trình duyệt hoặc iPhone.

52 kiểm thử tự động hiện có bao phủ khởi động production bundle, native history, round-trip dự án, PNG alpha, màu/levels, mask, warp/freeze/restore, inverse geometry, grapheme tiếng Việt/emoji, collage/export/undo, giữ dự án khi quota lỗi, giải phóng nguồn khi đổi dự án, export snapshot, gộp lớp và chuyển một sang hai điểm chạm.

`npm audit --omit=dev` và toàn bộ graph npm hiện không báo advisory. Đã bỏ dev server không dùng đến. Đây chỉ là kết quả audit npm, không phải chứng nhận an toàn cho toàn bộ mã vendored.

Chưa kiểm chứng: giao diện bằng trình duyệt thực; Safari/iPhone 16 Pro Max; VoiceOver; IME/bàn phím màn hình; PWA trong airplane mode; context loss trên GPU thật; EXIF/HEIC theo thiết bị; 48 MP; p95 frame, bộ nhớ và phiên 15 phút/100 nét. Môi trường không cung cấp công cụ browser QA được phép dùng; các mục này còn là gate trước phát hành chính thức.

Giới hạn hiện tại: xuất tối đa 12,5 MP; JPEG/PNG/WebP có kiểm MIME thực trả về; HEIC chỉ mở được khi trình duyệt có decoder. sRGB 8-bit; chưa hứa P3, HDR, RAW, xuất 48 MP hoặc tương đương toàn bộ Meitu. Bộ nội dung khởi đầu: 9 preset tự định nghĩa, 16 sticker hình học, 4 template, 5 bố cục collage, 2 font đóng gói theo OFL và font hệ thống.
