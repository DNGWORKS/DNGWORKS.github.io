# Đã thay đổi những gì so với source cũ

Đối chiếu với bản xuất `dngworks.github.io.zip` và với các lỗi P0 nêu trong
`DNGWORKS_SOURCE_AUDIT_2026-10-09.md`.

## Dọn kho

Source cũ 68 MB, phần lớn là thứ không phục vụ website:

| Bỏ | Lý do |
|---|---|
| `_site/` (34 MB) | Bản sao gần như nguyên vẹn của thư mục gốc |
| `app/ bootstrap/ database/ routes/ config/ artisan composer.json phpstan.neon pint.json` | Khung Laravel không được dùng trên một site tĩnh |
| `src/ vite.config.js bun.lock` | Pipeline Vite không được dùng |
| `docker/ docker-compose.toml netlify/ deploy/` | Ba cấu hình hosting khác nhau cho một site |
| 60+ file `README-V*.md`, `QA-REPORT-V*.json`, `PATCH-MANIFEST-*.json` | Nhật ký của các lần sửa trước |
| 9 file CSS (`site-v11`, `site-v12`, `site-v90`, `dng-system`…) | Chồng lấn nhau, không rõ file nào đang có hiệu lực |
| 23 file JS kể cả ba thế hệ form liên hệ | Như trên |
| 15 MB ảnh globe PNG (`ai-marketing-globe-reference.png` 3,7 MB…) | Tư liệu tham khảo, không trang nào dùng |

Còn lại 11 MB, trong đó 4,6 MB là asset thật đang được phục vụ.

## Giữ nguyên

Toàn bộ nội dung kinh doanh thật được chuyển sang, không mất chữ nào:

- 6 bài phân tích và 3 bản tin, đủ cả ba ngôn ngữ (9 bài × 3 = 27 trang bài).
- 5 case study portfolio, đủ ba ngôn ngữ, kèm 21 ảnh dự án.
- Bốn nhóm năng lực, quy trình năm bước, ba gói tham chiếu, quy trình brief.
- Thông tin liên hệ: `nguyendhungdung@gmail.com`, `0377 348 008`, Zalo, QR.
- Growth Check, ROAS, ROAS hoà vốn, CAC, LTV, UTM builder — thêm LTV/CAC.

## Lỗi P0 trong audit và cách xử lý

| Audit | Trong bản này |
|---|---|
| `renderNews()` chỉ in card chữ, ảnh bị mất ở tầng hiển thị | Mọi card đều có ảnh: ảnh nguồn khi có quyền, đồ hoạ biên tập khi không |
| Trang tin chỉ gọi `/api/news`, hỏng trên hosting tĩnh | Màn hình đầu là HTML dựng sẵn; phần lưu trữ đọc `data/archive-<lang>.json` tĩnh. Không có API nào cần chạy |
| `popular_vn` bị gán thẳng vào chuyên mục `marketing` | Chuyên mục suy ra từ chấm điểm liên quan trên tiêu đề và tóm tắt, có ghi lại lý do từng tin |
| `updated_at` đặt bằng `now()` mỗi lần gọi | `publishedAt`, `fetchedAt`, `snapshotUpdatedAt` là ba trường riêng |
| Tự chèn ngày mặc định `"Tháng 8, 2026"`, `"Mới cập nhật"` | Không có ngày thì hiển thị *"Không rõ ngày đăng"* |
| Fetch RSS ngay trong request của khách, parse XML bằng regex | Lấy tin theo lịch bằng `npm run news`, parser XML có tokenizer thật (`scripts/lib/xml.mjs`) |
| `sources` trong JSON không được truyền ra API | Nguồn tham chiếu hiển thị ở cột bên của từng bài |
| Bài gốc chỉ đọc trong modal, không có URL riêng | Mỗi bài có route riêng, metadata riêng, nút bài tiếp theo và đọc thêm |
| Nội dung từ API đẩy thẳng vào `innerHTML` | Mọi giá trị đi qua `textContent` hoặc bộ escape; chỉ nhận link `https` |
| Endpoint liên hệ trả `ok: true` dù không lưu gì | Form báo đúng trạng thái; chưa nối endpoint thì nói thẳng và chỉ sang email/Zalo |
| Poster ẩn đi trước khi xác nhận đã render | Poster chỉ mờ sau khi renderer báo đã vẽ frame thật; lỗi hoặc quá hạn thì poster ở lại |
| Veil trắng 0.96 phủ toàn hero, dìm scene | Scrim chỉ phủ vùng chữ, trong suốt hoàn toàn trước 64% bề ngang |
| Không có xử lý mất WebGL context | Có `webglcontextlost`/`restored`, giải phóng tài nguyên khi tháo |

## Nâng cấp thêm

**Nội dung và cấu trúc**

- Ba ngôn ngữ đầy đủ ở mọi trang: 67 trang HTML thay vì bản dịch lẻ tẻ.
- `hreflang` đúng cho cả ba, `x-default` trỏ về bản tiếng Việt.
- Structured data đúng loại: `NewsArticle` cho bản tin, `Article` cho phân
  tích, `BreadcrumbList`, `ProfessionalService`, `ItemList`.
- Trang `/intelligence/source-policy/` công khai cách chọn tin và xử lý ảnh.

**Giao diện**

- Một hệ thiết kế duy nhất (`src/styles/`), biên dịch thành một file 50 KB,
  thay cho 9 file CSS chồng lấn.
- Ngôn ngữ thị giác bản vẽ kỹ thuật: keyline chữ L, dimension tick, node
  vuông. Không còn lưới card bo tròn lặp lại khắp trang.
- Bố cục khác nhau theo từng khối tin, để trang tin không đọc như một lưới
  duy nhất lặp lại.

**Scene 3D**

- Chủ thể mới có silhouette nhận ra được trong ảnh tĩnh: chồng phiến kính mờ
  quanh trục kim loại, thay cho khối hình học xoay.
- Ba trạng thái theo scroll hoàn tất khi hero còn trong tầm nhìn.
- Có tier cho máy yếu, giới hạn DPR, dừng render khi ngoài viewport.
- `prefers-reduced-motion` vẽ một frame ở trạng thái hoàn chỉnh.

**Hiệu năng**

- Three.js rút gọn còn 560 KB (142 KB sau nén) từ ~2,1 MB, nạp động chỉ ở
  trang chủ.
- Font self-host, chia subset: người đọc tiếng Việt tải 224 KB; subset tiếng
  Trung chỉ chứa 1.054 ký tự thật sự xuất hiện trong nội dung.
- Ảnh WebP ba cỡ kèm `srcset`; ảnh bài viết là SVG (2–3 KB mỗi hình).

**Kiểm tra**

- `npm run verify` chặn phát hành: kiểm 2.159 link nội bộ, 644 asset, title,
  description, `noindex` của portfolio, sitemap, và tính nhất quán của dữ
  liệu tin. Phải pass mới nên đẩy.

## Còn lại

- **Kho tin đang có 12 bài**, dưới mục tiêu 24. Dữ liệu đi kèm lấy từ bản xuất
  của hệ thống cũ, vốn là RSS tin tổng hợp — sau khi lọc theo chuyên ngành chỉ
  còn 12 bài hợp lệ. Chạy `npm run news` từ máy có mạng ra ngoài để lấy đủ.
  Không chế thêm tin để lấp chỗ trống.
- **Hai nguồn chưa bật**: TikTok for Business và Meta for Business chưa tìm
  được feed công khai. Đã ghi trong `content/news-sources.json` với
  `verified: false`, nên script không lấy.
- **Form liên hệ chưa nối endpoint.** Xem phần Form liên hệ trong README.
- **Chính sách ảnh của BBC và VnExpress** đang dựa trên việc feed của họ tự
  phát hành `media:thumbnail` cho hiển thị kèm link gốc. Nên xác nhận lại với
  điều khoản hiện hành trước khi mở rộng phạm vi dùng ảnh.
