# PHOTO BEAUTY STUDIO V2 — preview trước khi áp dụng

Ngày 12/11/2026 (Asia/Bangkok). Tiếp tục source preview `9359270`, không thay site chính. User yêu cầu nâng cấp và duyệt preview chạy thật; triển khai trong nhánh `preview/premium-v2` trên Site preview hiện có.

## Kết luận kiểm tra

V1 preview có viewport tách riêng và bottom sheet, nhưng trang chủ còn là màn chọn ảnh mẫu; tool nâng cao vẫn kế thừa bảng dài; chỉ có 9 filter; không có preset người dùng hoặc lịch sử trực quan; chữ chưa có gradient. Lõi miniPaint/native history, Blob nguồn bất biến và project version 1 được giữ lại. Mọi chức năng mới dùng layer/action hiện có; không thêm engine.

## Hướng thiết kế

Home theo bố cục editorial: pearl white, charcoal typography, ảnh có quyền sử dụng, một CTA mở ảnh rõ ràng, lối vào nhanh và bản nháp thật. Editor thành darkroom: ảnh lớn trên graphite, chrome gọn, dock ngang và sheet pearl. Mỗi nhóm công cụ có giao diện riêng; không dùng chung một bảng form dài. Không giả VIP/cloud/AI/video hoặc các công cụ chưa triển khai.

Đề xuất thêm: nhấn giữ so sánh, thumbnail bản nháp thật, công thức màu cá nhân, timeline lịch sử của phiên hiện tại, kiểu chữ và khung ảnh có thể hoàn tác. Dữ liệu preferences/thumbnails tách khỏi DB dự án.

## Triển khai và nghiệm thu

1. Đo baseline CPU/warp và kiểm thử cũ; ghi đúng môi trường, không quy đổi thành kết quả iPhone.
2. Mở rộng catalog filter bằng tham số engine hiện có, lưu preset local và thêm gradient/font OFL cho typography. Viết kiểm thử pixel/lưu dữ liệu trước.
3. Thêm makeup layer thực, dùng mask/renderer hiện có và một native action history; kiểm save/load, alpha, liên kết geometry với ảnh gốc.
4. Nâng UI home/editor/tool, history/preset/frame, giữ các thao tác cũ. Những điều khiển không có backend thật sẽ không xuất hiện.
5. Kiểm thử hồi quy dự án V1, JPG/PNG, ảnh lớn, cancel gesture, IME; benchmark memory/latency trong môi trường hiện có. Tối ưu điểm nghẽn được đo, không thay thuật toán không cần thiết.
6. Build, review và cập nhật Site preview riêng. Chỉ áp dụng site chính sau khi user duyệt.

Browser hiện chưa kết nối Opera; không có cua_repl.js. Kiểm thử Safari/iPhone thật, VoiceOver và long-run là gate chưa đóng. Bản preview phải nói rõ giới hạn xuất và dữ liệu nào lưu qua phiên.
