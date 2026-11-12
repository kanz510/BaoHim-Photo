# BaoHim Photo V5 · CN Edition | Design handoff (text-first)

**Trạng thái:** Thiết kế đã được chủ dự án duyệt. Đây là tài liệu tham chiếu để triển khai; KHÔNG phải code giao diện đã hoàn thành.
**Ứng dụng hiện tại:** V4 trên main, engine V3/V4 vẫn phải giữ nguyên.
**Khổ ưu tiên:** iPhone 16 Pro Max, 440 × 956 CSS px, DPR 3; thử thêm 390 × 844, 375 × 812, landscape.
**Lưu ý nguồn ảnh:** 7 ảnh concept gốc được duyệt trong hội thoại ChatGPT, CHƯA được upload vào repo bởi tài liệu này. Đừng tuyên bố đã nhìn ảnh gốc từ repo; mô tả dưới đây đủ để làm đợt Shell/Home trước và giữ nhất quán các đợt sau.

## A. Định hướng thị giác đã duyệt

Phong cách ảnh lớn, giao diện chỉnh ảnh đen than tối giản, typography trắng ngà, nhấn Berry Pink tiết chế, tham chiếu tinh thần Xingtu (醒图), Meitu (美图秀秀), Qingyan (轻颜相机); tuyệt đối không sao chép artwork/icon độc quyền.

- Nền chính: #141416; nền phụ: #1D1D21; surface: #242429.
- Chữ chính: #F5F3F2; phụ: #A9A8B0; muted: #777780.
- Accent: #C46890; active: #E27FAB; viền sáng alpha 11%.
- Font: -apple-system, BlinkMacSystemFont, SF Pro, Segoe UI, sans-serif; không CDN, không font độc quyền.
- Grid spacing 4 px, thường 8 / 12 / 16 / 24; card radius 14 px, sheet radius 20 px.
- Vùng chạm tối thiểu 44 × 44 CSS px; thumbnail filter hiển thị 58–70 px (đề xuất 62 px).
- Topbar 52 px + safe-area; compact dock mục tiêu ~196 px, thích nghi 160–228 px + safe-area; không thêm nhiều lớp dock.
- Chuyển trạng thái ~170 ms chỉ opacity/transform cho controls; không animation height stage/canvas.

## B. 7 màn hình/trạng thái chủ đạo

### 01 Chỉnh màu (Ánh sáng & Màu)
Bố cục editor chuẩn: một ảnh rất lớn giữa header và một dock nhỏ sát đáy. Phía trên dock có Undo/Redo, giữ để xem Trước/Sau và Fit. Dock có tab phụ "Ánh sáng | Màu sắc | Chi tiết | HSL | Đường cong"; dải chọn công cụ nhỏ, chọn Phơi sáng/Độ sáng/Tương phản/Vùng sáng/Vùng tối; chỉ một slider hiện tại và số liệu. Tên công cụ và active màu berry. Không xếp hai menu chức năng trùng nhau.

### 02 Bộ lọc
Ảnh lớn, một hàng category "Tất cả | Film | CCD | Hàn | Nhật | ..." cuộn ngang, một hàng preset thumbnails 62 px + nhãn ngắn, một slider cường độ. Khi nhấn preset phải preview thật qua Facade. Nút Hủy/Áp dụng có nghĩa rõ ràng, không tạo lịch sử giả; LUT .cube được giấu sau nhóm nâng cao, không phô filename cho người dùng cơ bản.

### 03 Làm đẹp
Một hàng công cụ Mịn da/Xóa mụn/Dưỡng sáng/Chỉnh mặt/Trang điểm, một slider theo công cụ. Chỉnh bằng cọ trên ảnh đúng theo tọa độ pixel/world đã có. Bộ công cụ advanced phải đi vào tab phụ thay vì tạo bảng dài.

### 04 Trang chủ
Trang chủ V5 dark editorial: wordmark BaoHim Photo V5 + cánh hoa rất tiết chế, hero chân dung toàn chiều ngang với CTA "Chỉnh ảnh", grid truy cập nhanh Làm đẹp/Makeup/Chỉnh dáng/Bộ lọc, dải công cụ nhỏ Chỉnh màu/HSL & Curve/Xóa vật thể/Ghép ảnh/Chữ/Sticker; carousel Phong cách gợi ý và Dự án gần đây lấy từ project repository thực. Bottom navigation Trang chủ/Mẫu/[+]/Dự án/Cá nhân nhưng các tab thiếu tính năng thật không được giả. Không thêm VIP, thanh toán hay AI chỉ vì concept có minh họa.

### 05 Trang điểm (Makeup)
Ảnh chân dung rất lớn. Dải công cụ Môi/Mắt/Má/Lông mày/Eyeliner/Mi/Highlight cuộn ngang; phía dưới một hàng preset swatch/thumbnails, một slider Cường độ, sub-actions như Màu son/Chất son/Độ bóng/Viền môi chỉ xuất hiện khi chọn môi. Các công cụ phải kết nối makeup engine cũ, không dùng pixel demo.

### 06 Chỉnh mặt & vóc dáng
Ảnh lớn, switch "Chỉnh mặt | Chỉnh vóc dáng"; tab con Khuôn mặt/Mắt/Mũi/Môi/Lông mày/Cằm/Tổng thể, tool choices Thon mặt/V-line/Hàm/Gò má/Trán/Cân đối; một slider. Các tương tác gesture/pin theo engine Reshape hiện tại; không cắt hoặc làm méo nền do UI.

### 07 HSL & Đường cong
Mặc định HSL compact: một hàng 8 nút chọn dải màu, CHỈ slider tham số đang chỉnh hiện ra trong dock nhỏ. Khi cần, mở graph Tone Curve dạng expanded, không che ảnh mặc định. Curve có RGB/R/G/B và các preset; màu control rõ ràng, touch targets lớn. Không hứa histogram nếu engine chưa cấp dữ liệu thật.

## C. Cấu trúc chung bắt buộc

1. Trang chỉnh ảnh gồm EditorTopBar, ImageStage, EditorHUD, CompactDock. Một canvas engine duy nhất. Không lồng hai thanh công cụ chính.
2. Khi đổi tool/tab chỉ thay nội dung dock, không tự zoom hoặc thay world anchor.
3. Fit mode phải hiển thị trọn ảnh không crop/che; Manual zoom/pan giữ scale + điểm neo khi đổi công cụ.
4. Panel nâng cao có thể expanded theo yêu cầu người dùng; không để compact mặc định chiếm gần nửa màn hình.
5. Hủy thay đổi đang preview ≠ Undo lịch sử commit. Save/Export qua V4 facade, không lưu ảnh bản thu nhỏ của prototype.
6. Dùng state/aria-selected, role/tablist/labels phù hợp; hỗ trợ safe-area, Safari dynamic visualViewport; reduced-motion.
7. Toàn bộ công cụ cũ còn đường đi: Auto, Beauty, Face/Body Reshape, Makeup/Hair, Filter/LUT, HSL/Curve, Crop/Rotate/Resize, Text, Sticker, Frame, Collage, Layer, History. Không cắt tính năng để khớp ảnh concept.

## D. Thành phần sử dụng chung

EditorShell(mode,isDirty,saving,photoName), EditorTopBar(title,saveState,onSave,onBack), ImageStage(fit/manual,zoom,pan,compare), CompactDock(mode,expanded,keyboardVisible), ToolModeTab(selected,onSelect), ToolChoiceStrip(activeId,items), FilterPresetStrip(presets,selected), StrengthSlider(value,min,max,step), ColorChannelStrip(channels,selected), ToneCurvePanel(channel,points,onChange), CompareHoldButton(pressed), SheetActionBar(cancel,apply,reset), DraftProjectCard(project).

Các tên trên là hợp đồng thiết kế, không bắt buộc áp đặt framework mới. V4 hiện là JS modules/DOM/CSS.

## E. Tính bất biến và phạm vi

- Không thêm AI, video, dịch vụ đám mây trả phí, VIP/thanh toán.
- Giữ nguyên engine hiện hữu: PremiumFacade, GPU Liquify + CPU fallback, Web Worker, undo/redo, layers, project schema, autosave/IndexedDB, export và service worker offline.
- Không tái sử dụng logic pixel của preview-v4/app.js: đó là demo giới hạn cạnh ảnh.
- Không thay save key. Không hardcode ảnh mẫu thành ảnh dự án người dùng.
- Nhánh đích main; commit từng phần, không force-push. V5 chỉ bật theo ?ui=v5 trong đợt đầu; V4 mặc định vẫn chạy ổn.

## F. QA nghiệm thu chung

- Screenshot WebKit 440×956 DPR3, 390×844 và 375×812; đừng giả lập thanh status iOS trong ứng dụng web.
- Ảnh 1000×1500, 1500×1000, 1000×1000, 1000×2000: Fit hiển thị trọn vẹn, không đè dock.
- 30 lần đổi công cụ không zoom nhảy; Manual 200% giữ tâm world.
- Pinch/pan, compare hold, tool switching touch, Undo/Redo, JPG/PNG/WebP, dự án lưu/mở lại, offline, GPU fallback.
- npm run check; npm test; npm run test:webkit; npm run build. CI Pages thành công mới báo hoàn thành.
- Không tuyên bố đã kiểm thử iPhone vật lý khi chỉ chạy Playwright WebKit.

**Giai đoạn triển khai:** Đợt 1 Shell/Home → Đợt 2 Filter/Color/HSL/Curve → Đợt 3 Beauty/Makeup/Hair → Đợt 4 Face/Body/Crop/Text/Sticker/etc → Đợt 5 full QA + switch default V5 sau khi user duyệt.
