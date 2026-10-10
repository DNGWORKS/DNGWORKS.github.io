# Hệ thiết kế DNGWORKS

Ghi lại các quyết định thiết kế để lần sửa sau không phá vỡ hệ thống.

## Ý niệm

DNGWORKS là **growth architect** — tìm ra các mảnh tăng trưởng rời rạc, xác
định quan hệ giữa chúng, rồi xếp thành một hệ thống vận hành được.

Ngôn ngữ thị giác đi theo đúng nghĩa đó: **bản vẽ kỹ thuật**, không phải bộ
card bo tròn. Cụ thể:

- Khối nội dung dùng **keyline hình chữ L** (viền trái + viền trên, bo 2px),
  không viền bốn cạnh, không đổ bóng.
- Ranh giới giữa các section là **hairline kèm dimension tick** rơi xuống
  gutter trái — ký hiệu "đã đo", không phải trang trí.
- **Node vuông mint 6px** đánh dấu một điểm đã xác định: trước nhãn section,
  trước mỗi gạch đầu dòng, dưới mục menu đang mở.
- Bóng đổ chỉ dùng cho **ảnh**, không dùng cho khối chữ.

Những thứ cố ý tránh: eyebrow IN HOA giãn chữ, chuỗi meta nối bằng dấu chấm
giữa, số 01/02/03 ở chỗ nội dung không phải trình tự, mũi tên gắn đuôi nút.
Số thứ tự chỉ xuất hiện ở quy trình brief → đề xuất, vì đó là trình tự thật.

## Màu

Khai báo tại `src/styles/01-tokens.css`. Không trang nào được viết mã màu thô.

| Token | Mã | Dùng cho |
|---|---|---|
| `--canvas` | `#ffffff` | Nền chính |
| `--canvas-tint` | `#f2f7ff` | Section xen kẽ |
| `--canvas-dark` | `#101f39` | Band tối — chỉ dùng 1–2 lần mỗi trang |
| `--ink` | `#112743` | Tiêu đề |
| `--body` | `#314660` | Chữ thường |
| `--muted` | `#6b7f99` | Meta, chú thích |
| `--cobalt` | `#285be8` | CTA, keyline, liên kết |
| `--mint` | `#12bca4` | Node, dấu xác nhận, nhấn thương hiệu |
| `--coral` | `#f18b53` | Cảnh báo, triệu chứng — rất hạn chế |
| `--line` | `#dde8f5` | Hairline |

Band tối dùng cho footer, dải CTA và khối preview DNG Intelligence ở trang chủ.
Thêm band tối thứ ba sẽ phá nhịp sáng của toàn trang.

## Chữ

**Be Vietnam Pro** cho VI và EN, **Noto Sans SC** (subset) cho ZH. Cả hai
self-host trong `assets/fonts/`, không phụ thuộc Google Fonts.

| Vai trò | Cỡ | Cân nặng |
|---|---|---|
| Hero | `clamp(2.4rem, …, 3.6rem)` | 700, tracking −0.032em, leading 1.02 |
| H1 trang | `clamp(2.05rem, …, 3.35rem)` | 600 |
| H2 section | `clamp(1.6rem, …, 2.3rem)` | 600 |
| Chữ thường | 17px | 400, leading 1.62 |
| Thân bài viết | 19px | 400, leading 1.72 |
| Meta | 13px | 600 |

Chữ nhỏ nhất trên trang là 13px. Không dùng in nghiêng. Không tô màu một từ
trong tiêu đề để nhấn.

Tiếng Việt dài hơn tiếng Anh khoảng 20%, nên cỡ hero bị khống chế ở 58px: lớn
hơn nữa thì câu `Chọn đúng hướng tăng trưởng.` vỡ thành năm dòng trong cột
chữ và hero tràn quá một màn hình.

## Bố cục

- `--shell` 1440px cho nội dung, `--measure` 46rem (~72 ký tự) cho vùng đọc.
  Chỉ vùng đọc bị giới hạn bề ngang; hero và section 3D được tràn mép.
- Lưới 12 cột trên desktop, 6 cột dưới 60rem, 1 cột dưới 36rem.
- Hero: chữ 44% bên trái, scene 3D chiếm phần còn lại và tràn mép phải. Chiều
  cao tối thiểu `calc(100svh - 4.5rem)`.
- Hero trên mobile: chữ và CTA trước, scene nằm dưới trong dải riêng. Scene
  không bao giờ đè lên nút.

## Scene 3D

Chủ thể: **bảy phiến kính mờ quanh một trục kim loại satin**. Rời rạc → khớp
vào nhau có đường nối → nghiêng và mở quạt về phía trước. Đó là Chẩn đoán →
Kết nối → Tăng trưởng, dựng thành vật thể.

Vì sao là phiến kính mờ chứ không phải kính trong: bảy tấm kính trong xếp
chồng sẽ cộng dồn thành một mảng trắng bệt, mất hết chiều sâu. Kính mờ có
`depthWrite: true` nên tấm trên che tấm dưới và cấu trúc đọc được.

Viền vẽ từ **đường biên 2D của phiến**, không phải từ `EdgesGeometry` của khối
đã bevel — chạy trên khối đặc sẽ trả về ba đường gần song song cho mỗi cạnh và
silhouette thành mớ dây.

Ràng buộc kỹ thuật, nằm trong `src/js/hero-growth-architecture.js`:

- Poster là hình vẽ đầu tiên, chỉ mờ đi **sau khi** renderer báo đã vẽ xong
  frame thật. Lỗi WebGL, mất context hay quá 2,6 giây thì poster ở lại.
- Scrim trắng chỉ phủ vùng chữ và trong suốt hoàn toàn trước 64% bề ngang.
  Không phủ veil lên toàn bộ composition.
- Ba trạng thái scroll hoàn tất khi hero còn trong tầm nhìn, không phải sau
  khi hero đã trôi khỏi màn hình.
- DPR giới hạn 1,5–1,85 theo cấu hình máy; renderer dừng khi ra khỏi viewport;
  mọi tài nguyên GPU được giải phóng khi tháo.
- `prefers-reduced-motion` vẽ đúng một frame ở trạng thái hoàn chỉnh.

Poster render từ chính scene (`npm run assets`), nên bản dự phòng luôn khớp
art direction.

## Ảnh

- Ảnh thật của dự án: WebP, ba cỡ 480/768/1200, kèm `srcset`.
- Ảnh bài viết: SVG do DNGWORKS vẽ, trong `assets/images/covers/`. Mỗi bài có
  một hình khớp nội dung bài đó, không dùng ảnh stock.
- Tin ngành không có ảnh hợp lệ: dùng đồ hoạ biên tập dựng bằng CSS, đổi
  gradient theo chuyên mục, có hairline kẻ ô để mảng lớn không bị trống.
  Luôn gắn nhãn là đồ hoạ minh hoạ.

## Chuyển động

- Intro scene dưới 1,1 giây. Không loader toàn màn hình.
- Hover phản hồi 160–260ms. Không hiệu ứng trượt-và-mờ ở từng section.
- Chuyển động tự chạy chỉ có hai chỗ: scene 3D và mũi tên gợi ý cuộn.

## Ngưỡng chất lượng

- Tương phản đạt WCAG AA. Focus luôn thấy được, không bao giờ bị tắt.
- Vùng chạm tối thiểu 44px.
- Trang dùng được khi tắt JavaScript: màn hình đầu của toà soạn là HTML thật,
  chỉ phần lưu trữ có lọc là cần JS.
- Không có mã màu thô trong CSS trang. Không có chuỗi chữ trong template —
  mọi câu chữ đến từ `content/`.
