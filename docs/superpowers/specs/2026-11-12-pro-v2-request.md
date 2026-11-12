# PHOTO BEAUTY STUDIO PRO V2 — PREMIUM REDESIGN & FULL DEVELOPMENT

Tiếp tục phát triển dự án PHOTO BEAUTY STUDIO hiện tại. Mục tiêu là biến ứng dụng thành một sản phẩm chỉnh sửa ảnh cao cấp, lấy cảm hứng từ Meitu (美图秀秀) bản Trung Quốc, Xingtu (醒图) và Lightroom Mobile.

Đây không phải nhiệm vụ thay màu giao diện. Tôi muốn nâng cấp mạnh mẽ cả UI/UX, trải nghiệm chỉnh sửa ảnh, hiệu năng và chất lượng sản phẩm.

## 1. NGHIÊN CỨU SOURCE CODE

Kiểm tra và đối chiếu toàn bộ 9 repository sau:

1. https://github.com/viliusle/miniPaint
2. https://github.com/scaleflex/filerobot-image-editor
3. https://github.com/xdadda/mini-photo-editor
4. https://github.com/evanw/glfx.js
5. https://github.com/ikuaitu/vue-fabric-editor
6. https://github.com/dromara/yft-design
7. https://github.com/Qiu-Jun/mobile-fabric-editor
8. https://github.com/mtsee/image-editor
9. https://github.com/ximing/fabric-photo

Yêu cầu:
- Kiểm tra code thực tế, README, dependency, license và tình trạng bảo trì.
- Đánh giá khả năng chỉnh ảnh, layer, filter, typography, sticker, collage, Liquify và tương thích mobile.
- Chọn một engine chỉnh ảnh chính.
- Chỉ tích hợp thuật toán hoặc thư viện bổ sung khi thực sự cần thiết.
- Không ghép nguyên nhiều ứng dụng độc lập vào một sản phẩm.
- Không sao chép tài nguyên độc quyền.
- Kiểm tra bảo mật và xung đột phiên bản thư viện.

Giữ lại engine hiện tại nếu nó đã hoạt động tốt. Không viết lại toàn bộ chỉ vì muốn thay giao diện.

## 2. SỬ DỤNG CÁC PLUGIN/MCP ĐÃ CÀI

Trước khi triển khai, hãy kiểm tra danh sách công cụ và plugin thực sự khả dụng trong môi trường Codex.

Bắt buộc tận dụng:

### Figma
- Thiết kế hệ thống giao diện Premium V2.
- Tạo design system gồm màu sắc, typography, spacing, icon và component.
- Thiết kế trang chủ, màn hình chỉnh ảnh, bảng filter, làm đẹp, typography và sticker.
- Dùng Figma làm chuẩn thiết kế khi triển khai giao diện thực tế.
- Không dừng lại ở mockup.

### Playwright
- Tự mở website preview và kiểm thử.
- Mô phỏng iPhone 16 Pro Max, viewport 440 × 956.
- Kiểm tra responsive, touch, scroll, zoom, slider và thao tác ảnh.
- Kiểm tra filter, Undo/Redo, trước/sau, chữ, sticker, lưu và xuất ảnh.
- Chụp screenshot trước và sau mỗi giai đoạn sửa.
- Tự phát hiện và sửa lỗi.

### Chrome DevTools
- Kiểm tra Console, Network và lỗi JavaScript.
- Phân tích tốc độ tải ảnh, bộ nhớ và hiệu năng render.
- Tìm nguyên nhân giật lag khi xử lý ảnh lớn.
- Kiểm tra tài nguyên không tải được.

### Context7
- Tra cứu tài liệu React, TypeScript, Fabric.js, WebGL và các thư viện đang sử dụng.
- Sử dụng API đúng phiên bản.
- Không tự suy đoán hoặc sử dụng API lỗi thời.

### GitHub
- Đồng bộ source mới nhất.
- Kiểm tra commit, thay đổi và dependency.
- Kiểm tra diff trước khi hoàn thành.
- Không sửa repository khác.

Không được tuyên bố đã sử dụng plugin nếu chưa thực sự gọi công cụ. Nếu plugin không truy cập được, báo rõ và sử dụng phương án thay thế.

## 3. ĐẠI TU GIAO DIỆN PREMIUM V2

Phong cách: PREMIUM BEAUTY STUDIO.

Tham khảo Meitu Trung Quốc, Xingtu và Lightroom Mobile nhưng thiết kế thương hiệu riêng.

Bảng màu:
- Pearl White: #F9F6F7
- Mist Pink: #EAD9E4
- Rose Pink: #DF75A3
- Berry: #AF5B86
- Charcoal: #242229

Nguyên tắc:
- Sang trọng, tinh tế, hiện đại.
- Có chiều sâu thị giác.
- Icon SVG đồng nhất.
- Typography đẹp.
- Animation mượt.
- Không lạm dụng gradient, card, bóng đổ hoặc liquid glass.
- Không giống dashboard quản trị hay phần mềm desktop thu nhỏ.

### Trang chủ
Thiết kế lại hoàn toàn:
- Hero section với ảnh chân dung lớn.
- Nút Chỉnh ảnh mới nổi bật.
- Các lối tắt Làm đẹp, Chỉnh dáng, Ghép ảnh, Typography.
- Bộ sưu tập filter và phong cách nổi bật.
- Dự án gần đây, ảnh đã chỉnh sửa.
- Khu vực lưu preset và phong cách cá nhân.

### Trình chỉnh ảnh
- Ảnh là trung tâm, chiếm phần lớn màn hình.
- Tự động fit-to-screen khi mở ảnh.
- Pinch-to-zoom, kéo ảnh và reset zoom.
- Thanh trên cùng tối giản: Quay lại, tên công cụ, Lưu.
- Thanh công cụ dưới cùng có icon và nhãn ngắn.
- Bottom sheet kéo lên/xuống.
- Slider và thumbnail có kích thước phù hợp cảm ứng.
- Nút Undo/Redo và giữ để so sánh trước/sau.
- Không để bảng công cụ che phần lớn ảnh.
- Ẩn hoàn toàn menu desktop cũ trên giao diện mobile.

### Các phân hệ
Thiết kế giao diện riêng cho:
- Làm đẹp.
- Chỉnh màu.
- Filter.
- Chỉnh dáng.
- Makeup.
- Typography.
- Sticker.
- Khung.
- Collage.
- Template.
- Crop.
- Layer.
- Vẽ.

Không dùng một bảng điều khiển giống nhau cho tất cả chức năng.

## 4. TÍNH NĂNG CHỈNH ẢNH

Phải duy trì và hoàn thiện các nhóm tính năng sau:

### Chỉnh màu
Exposure, brightness, contrast, saturation, temperature, tint, HSL, curves, sharpen, blur, grain, vignette.

### Filter
- Chân dung.
- Film.
- Vintage.
- Hàn Quốc.
- Trung Quốc.
- Nhật Bản.
- Cinematic.
- Y2K.
- Black & White.

Có thumbnail thực tế, xem trước tức thì, thanh cường độ và khả năng lưu preset.

### Làm đẹp thủ công
- Mịn da.
- Sáng da.
- Xóa mụn và khuyết điểm.
- Chỉnh sắc da.
- Heal Brush và Clone Stamp.

### Chỉnh khuôn mặt và vóc dáng
- Liquify.
- Bóp mặt.
- Chỉnh mắt, mũi, môi, cằm.
- Chỉnh eo, chân, vai và chiều cao.
- Có khả năng đóng băng vùng ảnh để bảo vệ nền.
- Có Undo/Redo và xem trước.

Không dùng AI hoặc mô hình nhận diện AI.

### Makeup
- Son môi.
- Phấn má.
- Màu mắt.
- Lông mày.
- Cọ trang điểm.
- Điều chỉnh màu sắc và độ đậm.
- Hỗ trợ layer riêng.

### Typography
Đầu tư đặc biệt cho phần này:
- Kho font tiếng Việt, Trung, Hàn, Nhật.
- Font viết tay, nghệ thuật, dễ thương.
- Chữ cong, chữ vòng cung.
- Gradient, outline, shadow, glow.
- Chữ 3D giả lập.
- Khoảng cách ký tự và dòng.
- Bong bóng hội thoại.
- Nhiều layer chữ.
- Mẫu chữ và preset typography.
- Kéo, xoay, phóng to và chỉnh sửa trực tiếp.

### Sticker và ghép ảnh
- Sticker nhiều chủ đề.
- Khung ảnh.
- Collage.
- Poster.
- Ảnh dài.
- Template.
- Bố cục tạp chí.
- Layer và thứ tự trước/sau.

## 5. KIẾN TRÚC VÀ HIỆU NĂNG

- React + TypeScript + Vite nếu phù hợp với kiến trúc hiện tại.
- Canvas/WebGL cho xử lý ảnh.
- Chỉnh sửa không phá hủy ảnh gốc.
- Hỗ trợ nhiều layer.
- Lưu lịch sử chỉnh sửa.
- Lưu và mở lại dự án.
- Xuất JPG/PNG chất lượng cao.
- Tối ưu bộ nhớ khi xử lý ảnh lớn.
- Hạn chế render lại không cần thiết.
- Hỗ trợ PWA và offline.
- Không cần API trả phí.

TUYỆT ĐỐI KHÔNG:
- Sử dụng AI hoặc API AI.
- Xây dựng chức năng chỉnh sửa video.
- Tạo nút giả hoặc tính năng chỉ có giao diện.
- Xóa engine đang hoạt động tốt.
- Làm mất dữ liệu dự án cũ.

## 6. XỬ LÝ CÁC VẤN ĐỀ ĐÃ PHÁT HIỆN Ở V2

Kiểm tra và khắc phục:

1. Trạng thái "Đang mở ảnh của bạn…" chưa nhất quán với thông tin ảnh đã tải.
2. Thumbnail filter có các thẻ img với src rỗng.
3. Menu miniPaint desktop vẫn còn trong cấu trúc giao diện, gồm File, Edit, View, Layer, Effects, Tools và các bảng thuộc tính.
4. Trạng thái zoom 25% và 45% cần kiểm tra để tránh lệch trạng thái.
5. Kiểm tra ảnh tự động fit-to-screen.
6. Kiểm tra giao diện khi bảng công cụ mở rộng và thu gọn.
7. Kiểm tra các vùng chạm, thanh điều hướng và safe area.

Không được chỉ ẩn lỗi bằng CSS nếu nguyên nhân thực sự nằm ở trạng thái hoặc logic.

## 7. QUY TRÌNH TRIỂN KHAI

Chia thành các giai đoạn:

**Giai đoạn 1: Audit**
- Kiểm tra source hiện tại.
- Nghiên cứu 9 repository.
- Kiểm tra plugin.
- Đánh giá engine và kiến trúc.
- Báo cáo các vấn đề và phương án xử lý.

**Giai đoạn 2: Design V2**
- Thiết kế Figma.
- Xây dựng design system.
- Thiết kế trang chủ và trình chỉnh ảnh.
- Tạo preview thực tế trên điện thoại.

**Giai đoạn 3: Implement**
- Chuyển thiết kế vào code.
- Giữ engine và logic hiện tại.
- Hoàn thiện các nhóm công cụ.
- Không tạo chức năng giả.

**Giai đoạn 4: Testing**
- Playwright kiểm thử giao diện mobile.
- DevTools kiểm tra Console, Network và Performance.
- Kiểm thử ảnh thật, filter, Liquify, makeup, chữ, sticker, collage và xuất file.
- Chụp screenshot và lưu kết quả kiểm thử.
- Sửa lỗi rồi chạy lại test.

**Giai đoạn 5: Báo cáo**
Cung cấp:
- Link preview mới.
- Link thiết kế Figma.
- Danh sách plugin đã thực sự sử dụng.
- Source và thư viện đã chọn.
- Danh sách tính năng đã hoàn thành.
- Kết quả kiểm thử từng chức năng.
- Screenshot trước/sau.
- Những lỗi còn tồn tại.

## 8. NGUYÊN TẮC CUỐI CÙNG

- Chỉ làm việc trên repository PHOTO BEAUTY STUDIO hiện tại.
- Không sửa repository khác.
- Không thay thế bản ổn định trước khi preview V2 được duyệt.
- Không tự ý force-push hoặc xóa lịch sử.
- Không tuyên bố kiểm thử thành công khi chưa chạy thực tế.
- Ưu tiên chất lượng sản phẩm hơn số lượng tính năng.
- Chủ động đề xuất cải tiến nếu phát hiện cách làm tốt hơn.

**BẮT ĐẦU NGAY:** Kiểm tra repository, plugin và các lỗi V2 hiện tại. Sau đó triển khai theo quy trình trên, sử dụng Figma để thiết kế và Playwright/DevTools để kiểm thử. Không chỉ viết báo cáo hoặc đưa ra kế hoạch rồi dừng lại.