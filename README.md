# DNGWORKS — website

Website tĩnh của DNGWORKS: trang giới thiệu năng lực, bộ công cụ tính toán và
toà soạn **DNG Intelligence**. Ba ngôn ngữ: tiếng Việt, English, 简体中文.

Thư mục này **chính là website**. Đẩy nguyên vẹn lên GitHub và bật Pages là
chạy. Không cần build, không cần Node trên server, không có backend.

---

## Đẩy lên GitHub

1. Tạo repository tên `dngworks.github.io` (hoặc đẩy vào repo đang có).
2. Copy toàn bộ nội dung thư mục này vào repo, commit, push lên nhánh `main`.
3. Vào **Settings → Pages**, phần *Build and deployment* chọn
   **Deploy from a branch**, nhánh `main`, thư mục `/ (root)`.
4. Đợi vài phút, mở `https://dngworks.github.io/`.

File `.nojekyll` ở gốc đã có sẵn — nó tắt Jekyll để GitHub phục vụ đúng mọi
đường dẫn. Đừng xoá file này.

Xem thử trên máy trước khi đẩy:

```bash
npm run serve       # http://localhost:4173
```

Lệnh này chỉ phục vụ file tĩnh giống hệt GitHub Pages, không build lại gì.

---

## Cấu trúc

Phần **website** (những gì GitHub Pages phục vụ):

```
index.html              trang chủ tiếng Việt
en/  zh/                bản English và 简体中文 của toàn bộ trang
services/               giải pháp
tools/                  bộ công cụ tính toán
intelligence/           toà soạn DNG Intelligence
  briefings/<slug>/     bản tin DNGWORKS biên tập
  analysis/<slug>/      bài phân tích
  playbooks/<slug>/     playbook
  source-policy/        chính sách nguồn tin
about/  contact/        giới thiệu, liên hệ
portfolio/              case study — xem bên dưới
assets/                 css, js, font, ảnh
data/                   dữ liệu tin tức toà soạn đọc
404.html  robots.txt  sitemap.xml  favicon.svg  .nojekyll
```

Phần **nguồn** (để sửa về sau, GitHub Pages bỏ qua):

```
content/                toàn bộ nội dung chữ, tách khỏi giao diện
  i18n/{vi,en,zh}.json  mọi câu chữ trên giao diện
  site.json             thông tin liên hệ, menu, cấu hình
  articles.json         9 bài viết, đủ 3 ngôn ngữ
  portfolio.json        5 case study, đủ 3 ngôn ngữ
  news-sources.json     danh sách nguồn tin được phép lấy
src/                    template, CSS nguồn, JS nguồn, ảnh gốc
scripts/                script build và kiểm tra
```

---

## Sửa nội dung

Mọi câu chữ nằm trong `content/`. Không sửa trực tiếp file `.html` ở gốc —
lần chạy build sau sẽ ghi đè.

```bash
# sửa content/i18n/vi.json hoặc content/articles.json ...
npm run build       # render lại toàn bộ trang
npm run verify      # kiểm tra link, ảnh, SEO trước khi đẩy
```

`npm run build` cần Node 20 trở lên và không cần cài gói nào.

| Muốn đổi | Sửa ở |
|---|---|
| Chữ trên giao diện, tiêu đề, nút | `content/i18n/<ngôn ngữ>.json` |
| Điện thoại, email, Zalo, menu | `content/site.json` |
| Bài viết | `content/articles.json` |
| Case study | `content/portfolio.json` |
| Màu, cỡ chữ, khoảng cách | `src/styles/01-tokens.css` |
| Bố cục một trang | `src/build/pages.mjs` |

---

## Toà soạn DNG Intelligence

Trang tin đọc file tĩnh `data/news.json`, nên chạy được trên GitHub Pages mà
không cần API. Lấy tin mới:

```bash
npm run news            # lấy từ các nguồn đã xác thực, ghi lại data/news.json
npm run news:explain    # chạy thử, in lý do nhận hoặc loại từng tin
npm run build           # render lại trang tin
```

Script chỉ lấy từ nguồn có `"verified": true` trong `content/news-sources.json`.
Mỗi tin phải qua một cổng biên tập: chấm điểm liên quan tới kinh doanh,
marketing, AI, công nghệ và thương mại điện tử; loại thể thao, giải trí, tin
hình sự và các chủ đề ngoài ngành; khử trùng lặp theo URL chuẩn hoá và theo
tiêu đề gần giống.

Vài nguyên tắc đã được cài vào pipeline:

- Thời điểm đăng của bài gốc và thời điểm hệ thống lấy dữ liệu là hai trường
  khác nhau. Nguồn không cho ngày đăng thì trang ghi *"Không rõ ngày đăng"*,
  không đoán.
- Quyền dùng ảnh lấy từ `content/news-sources.json`, không mặc định. Nguồn
  chưa có quyền thì card dùng đồ hoạ biên tập của DNGWORKS và ghi rõ là đồ
  hoạ minh hoạ.
- Khi mọi nguồn lỗi, bản dữ liệu hợp lệ gần nhất được giữ nguyên và đánh dấu
  `stale`, kèm thời điểm đồng bộ thật. Không bao giờ hiện danh sách trống,
  cũng không tự tạo tin thay thế.

Dữ liệu đang đi kèm là 12 tin đã qua lọc từ bản xuất của hệ thống cũ. Mục tiêu
là 24 tin trong 14 ngày gần nhất — chạy `npm run news` từ máy có mạng ra ngoài
để đạt ngưỡng đó. `npm run verify` sẽ nhắc nếu chưa đạt.

Chính sách nguồn tin hiển thị công khai tại `/intelligence/source-policy/`.

---

## Portfolio

Năm case study có thật, đặt tại `/portfolio/` và `/portfolio/<slug>/`.

Các trang này **không** xuất hiện trong menu, footer, sitemap, và đều gắn
`noindex`. Link vẫn mở được nếu chia sẻ trực tiếp. Đây là lựa chọn hiển thị,
không phải bảo mật — ai có link đều xem được.

---

## Form liên hệ

Form hiện **chưa nối** với nơi nhận, và nó nói thẳng điều đó thay vì giả vờ
gửi thành công. Để bật:

1. Tạo endpoint nhận form (Formspree, Google Apps Script, Cloudflare Worker…).
2. Dán URL vào `content/site.json` → `contact.formEndpoint`.
3. `npm run build`.

Trước khi nối xong, người dùng vẫn thấy email, điện thoại, Zalo và mã QR.

---

## Script

| Lệnh | Việc |
|---|---|
| `npm run build` | Render toàn bộ trang từ `content/` và `src/` |
| `npm run check` | Build thử, chỉ báo cáo, không ghi file |
| `npm run verify` | Kiểm tra link chết, ảnh thiếu, SEO, dữ liệu tin |
| `npm run serve` | Xem thử tại `localhost:4173` |
| `npm run news` | Lấy tin mới vào `data/news.json` |
| `npm run fonts` | Dựng lại subset font tiếng Trung sau khi sửa chữ ZH |
| `npm run images` | Tạo ảnh responsive từ `src/images/` |
| `npm run assets` | Render lại poster 3D và ảnh chia sẻ mạng xã hội |

Ba lệnh cuối cần thêm công cụ (`Pillow`, `fonttools`, `playwright`) và chỉ cần
chạy khi thay ảnh gốc hoặc nội dung tiếng Trung. Kết quả đã nằm sẵn trong repo.

---

## Giấy phép và tài sản

- Mã nguồn và nội dung: thuộc DNGWORKS.
- Font **Be Vietnam Pro** và **Noto Sans SC**: SIL Open Font License 1.1,
  self-host trong `assets/fonts/` kèm giấy phép.
- **Three.js**: MIT, bản rút gọn trong `assets/js/vendor/`.
- Ảnh portfolio: của dự án thật, thuộc DNGWORKS và khách hàng.
- Ảnh bài viết: đồ hoạ biên tập do DNGWORKS vẽ, trong `assets/images/covers/`.
- Ảnh trong tin ngành: thuộc đơn vị xuất bản gốc, hiển thị theo chính sách ghi
  trong `content/news-sources.json`.
