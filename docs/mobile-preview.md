# Mobile UI preview

Preview riêng dựa trên commit `afc871367f6d62edbff3367fe23ee80e06c6548f`. Không thay ứng dụng đã phát hành. User yêu cầu prototype thao tác thật trước khi duyệt, nên đây là spike thiết kế, chưa phải rollout.

Ảnh là vùng chính. Một thanh trên (quay lại / tên công cụ / lưu), danh mục một hàng dưới, sheet ba mức: thu gọn / gọn / mở rộng. Pearl white, blush, rose, nét icon thống nhất; nút và slider có vùng chạm lớn. Chọn công cụ gọi các action hiện có. Preview có origin riêng nên không dùng chung IndexedDB với bản chính.

Các module xử lý ảnh, layer, action history, serializer/validator và project repository giữ nguyên. Bổ sung UI subclass, sheet/viewport controller và wrapper gesture cho chế độ xem. Sửa fit trong adapter hiển thị: tính từ vùng canvas thực, không ép ngưỡng 3% hoặc làm tròn 2 chữ số; sheet resize không tự xóa zoom do người dùng đặt.

Nghiệm thu prototype: mở ảnh, chọn màu/filter, chỉnh slider, undo/redo, dùng cọ, chỉnh chữ tiếng Việt, xuất ảnh/project; kéo sheet; không đổi dữ liệu tài liệu khi chỉ fit/resize sheet; ảnh lớn vẫn contain. Không có công cụ giả. Chỉ triển khai UI chính sau khi user duyệt.

Browser QA: Opera connector hiện báo không có browser kết nối; managed environment không cung cấp cua_repl.js. Không nhận là đã kiểm chứng Safari/iPhone thật.

Kiểm chứng tự động: production bundle dùng được với UI mới; các kiểm thử cũ về xử lý ảnh/layer/history/project tiếp tục qua; bổ sung kiểm contain ảnh lớn, các mức sheet, kéo sheet không sửa document, chỉnh slider/filter qua native actions, pan chế độ xem không tạo history và composition tiếng Việt. Không coi đây là kiểm thử layout hoặc Safari thật.
