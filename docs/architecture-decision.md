# Kiến trúc đang triển khai

Nền duy nhất là miniPaint `c9192c15918eb61f7dd89e362cf8065a276b89e9`. Không nhập tám ứng dụng còn lại. Không có React, Vue, Fabric hoặc mô hình layer thứ hai. Nghiên cứu đủ chín nguồn nằm trong `implementation-plan.md` và `source-register.json`.

- `app.Config.layers` là tài liệu; `app.State` và native action/bundle là lịch sử duy nhất.
- Blob nguồn bất biến được giữ riêng, gắn bằng `studio.sourceId`. Recipe lưu tham số màu, mask, warp, frame và typography; canvas xem trước không được ghi vào dự án.
- Pipeline: retouch/makeup trên source → inverse warp/phối cảnh → màu/levels/curve → lật → native transform/composite chữ, sticker, frame. Xuất dùng bản chụp trạng thái để không ảnh hưởng canvas đang chỉnh.
- Canvas 2D + ImageFilters/glfx có sẵn, không phụ thuộc `ctx.filter`. Preview 1.280–1.600 px; smoothing có cache theo nguồn/kích thước; warp giới hạn vùng ảnh khi không có phối cảnh. CPU vẫn chạy main thread; chưa tuyên bố đạt mục tiêu frame trên iPhone.
- IndexedDB lưu document + Blob trong một transaction. Mở ảnh khác phải lưu được tài liệu hiện tại trước; nếu quota lỗi, tài liệu hiện tại được giữ lại. File `.pbs.json` là bản lưu độc lập.
- Font, ảnh mẫu, sticker và template dùng file local; Service Worker cache có phiên bản. Không có backend xử lý ảnh, AI, video, telemetry hoặc API ảnh trả phí.

Hai điểm nối được điều chỉnh có chủ đích: `studio_text` vẫn là native text layer và native spans/history, bổ sung render grapheme/arc; utility pan/zoom cũ có nguồn dẫn Stack Overflow CC BY-SA 3.0 được thay bằng phép scale/translate MIT tại `viewport.mjs`, giữ interface miniPaint. Đây là thay utility có vấn đề về provenance, không đổi nền tảng.

Phối cảnh hiện có hai trục với inverse sampling; chưa có giao diện tự kéo độc lập bốn góc. Makeup là cọ, chưa có trình sửa đường Bézier. Không nhận diện mặt/người hay tự chọn vùng.
