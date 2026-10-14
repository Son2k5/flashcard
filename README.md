# Lá — Flashcard & Quiz thử thách

Ứng dụng học từ vựng đa ngôn ngữ dành cho nhóm nhỏ, giao diện tiếng Việt. Chạy hoàn toàn trong **một `index.html`**, không framework, backend, database hay bước build. Hoạt động phi thương mại; chỉ triển khai vào tài khoản **Vercel Hobby** của cá nhân, không bật tính năng trả phí.

## Mở ứng dụng

Mở URL production sau khi triển khai và nhập mã được chủ nhóm chia sẻ. Để chạy tại máy bằng Node.js:

```powershell
cd D:\HocTieng\flashcard
npx --yes serve@14.2.4 . -l 4173
```

Mở `http://localhost:4173`. `localhost` và HTTPS hỗ trợ Web Crypto cho cổng nhập mã. Có thể mở trực tiếp HTML trên trình duyệt hỗ trợ Web Crypto cho `file://`, nhưng nên dùng localhost hoặc URL Vercel. Nếu phục vụ cho điện thoại qua địa chỉ IP trong LAN bằng HTTP, Web Crypto có thể bị chặn; dùng URL HTTPS Vercel.

Ứng dụng chỉ tải **Mammoth.js 1.8.0** khi nhập Word, từ `https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js`. URL đã được xác minh có tồn tại và tải được dưới CSP. Không tải font, ảnh, âm thanh hoặc thư viện giao diện từ nguồn khác. Cần mạng cho lần tải thư viện; không có service worker/cache ngoại tuyến, nên không đảm bảo mở lại URL website khi mất mạng. Có thể tiếp tục học trong trang đã mở khi mất mạng.

## Nhập Word

- `.docx` thật, không có mật khẩu, tối đa 30 MB. Không hỗ trợ `.doc`, PDF hay tài liệu chỉ có ảnh.
- Heading 2 / Tiêu đề 2 → chapter; dòng in đậm → section. Heading 3/4 cũng được nhận làm section.
- Bảng từ 2 cột: cột đầu là từ, cột hai là nghĩa. Cột 3 trở đi thành ghi chú/ví dụ ở mặt sau thẻ và sau câu quiz.
- Nhận các dòng tiêu đề `Từ | Nghĩa`, `Từ vựng | Nghĩa`, `Word | Meaning`, `Cụm | Viết tắt`, và một số tiêu đề Nhật/Hàn/Trung. Nếu dùng tên cột khác, bỏ dòng tiêu đề hoặc đổi về `Từ | Nghĩa` để tránh bị coi là từ vựng.
- Không có Heading 2: giữ một chapter nguồn tên **Tất cả**, tự chọn gộp và vô hiệu hóa tách. Bảng trước chapter đầu tiên cũng được giữ dưới Tất cả. Bảng không có section dùng **Từ vựng chung**.
- Không nhận ô gộp hoặc bảng lồng. Dòng sai định dạng/thiếu từ hay nghĩa được liệt kê cảnh báo, các dòng hợp lệ vẫn có thể nhập sau khi xem trước.
- Bỏ tiêu đề và ghi chú ngoài bảng. Giữ dấu `/`, `=`, `><`, `→`, ngoặc, Unicode và xuống dòng nội bộ. Chỉ loại khoảng trắng ngoài cùng của ô và tách tiền tố loại từ nhận diện được. Nội dung gốc của cột từ vẫn nằm trong `originalWord`.

Sau khi nhập, kiểm tra chapter/section/số dòng và mẫu, đặt tên bộ và chọn ngôn ngữ. Hỗ trợ Anh, Nhật, Hàn, Trung, Pháp, Đức, Tây Ban Nha hoặc mã ngôn ngữ khác, ví dụ `it-IT`. **Cột nghĩa không bị gán cố định một ngôn ngữ.** Mặc định ngôn ngữ là Anh để thuận tiện cho file mẫu; đổi lựa chọn nếu học ngôn ngữ khác.

Mỗi lần upload tạo một bộ từ mới. Nếu là tài liệu đã chỉnh sửa, chọn **Kế thừa tiến độ và sao từ bộ cũ**. Mặc định chọn bộ có cùng tên file nếu có. Bộ cũ không bị ghi đè. Lịch sử quiz/ngày học của bộ mới bắt đầu riêng để không trộn thành tích của hai nội dung khác nhau.

## Tách / gộp và ID

Trong xem trước hoặc **Cài đặt bộ từ**:

- **Tách theo chapter:** giữ chapter và section làm nhóm học.
- **Gộp tất cả vào một bản:** một nhóm mang tên bộ từ; nguồn đầy đủ vẫn giữ nguyên.
- **Loại bỏ từ trùng lặp:** chỉ dùng khi gộp, so từ sau chuẩn hóa NFC, hoa/thường và khoảng trắng; giữ nghĩa đầu tiên, đưa nghĩa khác vào ghi chú.

ID thẻ là hash 128 bit xác định từ cặp `(word, meaning)` chuẩn hóa, độc lập vị trí/chapter/loại từ/ghi chú. Đổi nghĩa hoặc từ sẽ tạo ID mới; đổi thứ tự/ghi chú không đổi ID. Các dòng cùng cặp từ–nghĩa dùng chung ID và chỉ học một lần trong một phiên. Preview vẫn báo số dòng gốc. Mọi bản gốc luôn nằm trong dữ liệu xuất.

Đổi tách/gộp cần xác nhận. Không xóa trạng thái khi một nghĩa bị ẩn do loại trùng; bật lại tách hoặc bỏ loại trùng sẽ thấy trạng thái cũ. Bộ gộp vẫn có lựa chọn section gốc tại màn hình thiết lập quiz.

## Flashcard và thống kê

Chọn nhóm, tích một/nhiều section hoặc chọn tất cả; có lọc từ ⭐ khó. Space/chạm để lật, → đã thuộc, ← chưa thuộc. Thẻ chưa thuộc quay lại sau tối đa ba thẻ khác, tối đa hai lượt mỗi vòng; hết vòng dùng **Học lại từ chưa thuộc**. Nút đảo chiều và xáo trộn áp dụng phiên hiện tại.

Tìm kiếm trên toàn bộ cấu trúc gốc của bộ. Thống kê học theo nhóm đang hiển thị, ngày liên tiếp theo ngày địa phương trên thiết bị và có ít nhất một câu trả lời. Chuỗi vẫn được giữ nếu đã học hôm qua nhưng chưa học hôm nay.

## Quiz thử thách

Chọn bộ từ → chapter/section → nguồn tất cả/chưa thuộc/từ khó. Chọn 10/20/30/tất cả (giới hạn bởi lượng từ), 10/15/20/30 giây hoặc không giới hạn, hướng từ→nghĩa/nghĩa→từ/hỗn hợp, dạng trắc nghiệm/gõ/hỗn hợp. Có bật/tắt power-up, âm thanh, bot, xáo trộn và tự chuyển câu sau 2 giây.

- Ít nhất một từ để chơi. Thiếu bốn đáp án khác nhau thì câu đó chuyển sang gõ.
- Đáp án sai ưu tiên cùng loại từ trong phạm vi chọn, tiếp theo các từ khác trong phạm vi, cuối cùng trong cả bộ. Loại thẻ trùng từ hoặc nghĩa với câu đúng và loại đáp án trùng nhau.
- Phím **1–4** chọn đáp án; **Enter** nộp câu gõ. Bỏ qua hoa/thường, khoảng trắng thừa, tiền tố loại từ; khi đáp án là từ thì nhận một biến thể bất kỳ tách bằng `/`. Ký hiệu khác vẫn cần đúng. Các biến thể có thể là mảnh cụm từ nếu tài liệu dùng `/` để viết tắt cấu trúc; ứng dụng không tự suy diễn phần bị lược bỏ.
- Đúng: `600 + 400 × tỷ lệ giờ còn lại`. Không giới hạn: 1000 điểm cơ bản. Chuỗi 3 nhân 1.1, chuỗi 4 nhân 1.2… tối đa 1.5. Sai/hết giờ: 0 điểm, đặt chuỗi về 0. Giờ thêm không làm phần thưởng tốc độ vượt 400.
- Chuỗi 3, 6, 9… nhận ngẫu nhiên một power-up nếu túi còn chỗ (tối đa 3). **50/50** bỏ hai đáp án sai; **Thêm giờ** +10 giây; **Nhân đôi điểm** nhân đôi điểm câu hiện tại; **Cơ hội thứ hai** cho thử lại một lần khi chọn/gõ sai (không áp dụng hết giờ). Mỗi loại chỉ dùng một lần trong một câu. Phím **Q/W/E** ứng với vị trí trong túi; khi con trỏ đang trong ô gõ, dùng nút bấm để không nuốt ký tự.
- Bốn đối thủ **Bot** Mầm/Mây/Cáo/Sao có độ chính xác 55%/70%/82%/92% và tốc độ khác nhau. Chỉ mô phỏng phía client, không phải người thật. Khi đồng điểm, bạn đứng trước bot.
- Tạm dừng bằng nút hoặc Escape; chuyển tab tự tạm dừng. Khi thoát có xác nhận. Interval và timeout tự chuyển câu được dọn khi đổi câu/thoát/kết thúc.
- Kết quả có điểm, hạng bot, đúng/sai, độ chính xác, thời gian TB (không tính tạm dừng), chuỗi dài nhất, kỷ lục cũ/mới và từ sai. Có chơi lại, chỉ câu sai, thêm sao và đánh dấu chưa thuộc.
- Quiz **không tự ghi đã thuộc**. Đúng hai lần liên tiếp ở hai lượt chơi khác nhau đưa ra gợi ý, chỉ ghi đã thuộc khi bạn bấm chấp nhận.
- Điểm cao khóa theo bộ và tập chapter/section đã chọn (không phụ thuộc thứ tự). Hiển thị 5 điểm cao nhất và 5 lần gần nhất; giữ tối đa 100 lượt gần nhất cùng top 5. Luật chơi được ghi trong lịch sử vì số câu, thời gian, power-up khác nhau không thể so sánh ngang bằng. Phiên đang dở không lưu điểm cao và không khôi phục sau reload.

## Dữ liệu, phát âm và sao lưu

Mọi truy cập localStorage nằm trong try/catch. Khi lưu trữ bị chặn/đầy, hiện **Tiến độ sẽ không được lưu**; học trong bộ nhớ vẫn được. Không có phương pháp đáng tin cậy phát hiện mọi chế độ riêng tư: luôn có nhắc riêng tư có thể xóa dữ liệu khi đóng cửa sổ.

Mỗi bộ có tiến độ, sao, lịch sử, ngày học riêng. **Không có tài khoản và không đồng bộ**; người dùng dùng cùng profile trình duyệt sẽ nhìn thấy cùng dữ liệu. Đổi máy/trình duyệt/origin (localhost khác URL production, production khác URL preview) cần xuất/nhập.

**Xuất tiến độ** tải JSON chứa đầy đủ các bộ, cấu trúc gốc, cách nhóm, ngôn ngữ, trạng thái, sao, lịch sử và cài đặt giao diện/âm thanh. Không chứa mã truy cập. **Nhập tiến độ** kiểm tra tên ứng dụng, phiên bản 2, cấu trúc và ID rồi hỏi trước khi thay toàn bộ dữ liệu; giới hạn file 30 MB, 100 bộ, 100.000 dòng thẻ. Sao lưu chứa nội dung từ vựng của bạn, hãy giữ riêng và không commit.

Giọng đọc chọn đúng mã ngôn ngữ hoặc cùng họ ngôn ngữ từ danh sách giọng thiết bị; không có giọng thì ẩn loa và thông báo nhẹ. Bỏ tiền tố loại từ khi đọc. Giọng có thể cần mạng tùy hệ điều hành; âm thanh quiz được tổng hợp bằng Web Audio, không tải file. Đã kiểm tra gọi API/chọn ngôn ngữ, chưa xác nhận chất lượng âm thanh thực tế trên từng thiết bị.

## Mã truy cập

Chỉ có SHA-256 trong hằng `ACCESS_HASH` ở HTML, không có mã thô trong repo. Sau khi nhập đúng, trình duyệt lưu dấu nhớ gắn với hash. **Đây là lớp chắn nhẹ, không phải xác thực hay bảo mật thực sự.** Mã HTML và hash vẫn có thể đọc; người biết kỹ thuật có thể bỏ qua màn hình này. Không lưu dữ liệu nhạy cảm hay dùng nó bảo vệ dịch vụ trả phí.

Đổi mã bằng công cụ có sẵn, nhập mã mới không hiển thị ra terminal:

```powershell
node scripts/set-access-code.cjs
npm test
git add index.html
git commit -m "Change group access code"
git push origin main
```

Sau deploy, hash thay đổi khiến dấu nhớ cũ không còn hợp lệ ở lần mở lại. Chia sẻ mã mới trực tiếp cho nhóm. Không đưa mã vào README, lệnh shell chứa literal, issue hay commit message. Công cụ đọc mã từ stdin; không ghi bản thô.

## Kiểm tra

Dependency duy nhất trong `package.json` là **linkedom**, chỉ để cung cấp DOMParser cho test Node; ứng dụng và deploy không cần cài dependency.

```powershell
npm ci --ignore-scripts
npm test
```

16 nhóm test kiểm tra parse, mặc định Tất cả, bảng nhiều cột, Unicode, section trùng, ID, tách/gộp giữ tiến độ, loại trùng, kế thừa tiến độ, đáp án nhiễu, bộ ba thẻ, điểm/streak, gõ biến thể, phạm vi quiz, bot và kiểm tra backup. Fixture trong test là văn bản giả, không phải dữ liệu của người dùng.

Đã kiểm tra tự động trên Chrome bằng static server `npx serve` có CSP tương ứng cấu hình deploy: nhập file mẫu 11 chapter/27 section/609 dòng; flashcard; tách/gộp; nhiều bộ và kế thừa; quiz một/nhiều chapter; trắc nghiệm/gõ; hết giờ; pause; bốn power-up; bot; kết quả và sao; JSON export/import; reload; cổng mã; localStorage bị chặn; layout 390 px và dark mode. File Word thật, fixture `.docx`, bản sao lưu test và ảnh chụp đều nằm ngoài repo.

Các kiểm tra này chưa thay thế thử trên điện thoại thật, nghe giọng đọc/âm thanh thật, và kiểm tra deployment production sau khi đăng nhập CLI.

## GitHub và Vercel Hobby

Ứng dụng được chuẩn bị cho repo **PRIVATE** `vocab-flashcards`, nhánh `main`. Không commit Word, bản backup, `.env*`, token hay `.vercel`. `.vercelignore` cũng loại tài liệu, test và công cụ quản trị khỏi nội dung deploy CLI.

Nếu máy chưa có GitHub CLI, cài bản chính thức hoặc dùng bản portable đã chuẩn bị. Đăng nhập bằng tài khoản của bạn; không đưa token vào chat:

```powershell
gh auth login
gh auth status
gh repo create vocab-flashcards --private --source=. --remote=origin --push
```

Nếu repo tên này đã tồn tại, kiểm tra đúng owner/nội dung trước khi nối; không ghi đè repo khác. Nếu dùng bản portable ở `%LOCALAPPDATA%\Programs\GitHubCLI\bin`, thêm tạm vào PATH của PowerShell:

```powershell
$env:Path = "$env:LOCALAPPDATA\Programs\GitHubCLI\bin;" + $env:Path
gh auth login
```

Tiếp theo:

```powershell
npx vercel login
npx vercel
```

Chọn **scope cá nhân Hobby**, dự án `vocab-flashcards`, thư mục `.`. Framework **Other**, Build Command để trống, Install Command để trống, Output Directory `.`. Không nâng cấp gói, không bật add-on trả phí. Cấu hình này cũng nằm trong `vercel.json`.

Liên kết GitHub bằng URL repo vừa tạo:

```powershell
npx vercel git connect https://github.com/YOUR_USERNAME/vocab-flashcards
npx vercel --prod
```

Nếu Vercel yêu cầu cài/ủy quyền GitHub App, chỉ cấp quyền repo cần dùng. Trong dashboard → Project Settings → Git, kiểm tra repo đã nối và Production Branch là **main**. Kiểm tra plan của scope là **Hobby** trước deploy. Các thao tác đăng nhập/ủy quyền cần chủ tài khoản thực hiện.

Sau đó sửa `index.html` → chạy test → commit → `git push origin main` sẽ tự deploy production khi liên kết Git đã hoàn tất. Nếu chưa nối Git, dùng `npx vercel --prod` để deploy thủ công. URL production ổn định dùng chung cho nhóm; tránh chia sẻ từng URL preview nếu muốn giữ cùng vùng localStorage.

Kiểm tra sau deploy bằng URL thực được CLI trả về:

```powershell
curl.exe -I https://YOUR_PROJECT.vercel.app
```

Trang gốc phải trả HTTP 200, có nosniff, DENY, strict-origin-when-cross-origin và CSP. Thử thủ công: mở mã → upload Word → cả tách/gộp → lật thẻ → quiz → đóng/mở tab → xuất/nhập backup → thử trên điện thoại thật.

Tài liệu chính thức: [cấu hình Vercel](https://vercel.com/docs/project-configuration), [kết nối Git qua CLI](https://vercel.com/docs/cli/git), [deploy qua CLI](https://vercel.com/docs/cli/deploy).

## Header bảo mật và CSP

`vercel.json` bật cleanUrls, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`. CSP:

```text
default-src 'self';
script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self' https://cdnjs.cloudflare.com;
media-src 'self' blob:;
object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
```

`unsafe-inline` cần cho JS/CSS cùng file, không có `unsafe-eval`. `data:` cho favicon SVG; `blob:` hỗ trợ tài nguyên tạo tại máy. Xuất JSON dùng Blob URL và thuộc tính download, không tải lên server. Speech synthesis/Web Audio/localStorage không cần mở script nguồn khác. Không nới CSP cho Google Fonts, analytics, iframe hay API bên ngoài. HTML Word được đọc trong DOM bất hoạt, chỉ lấy text và escape trước khi render; không chèn HTML tài liệu vào giao diện. `robots.txt` và meta noindex/no-follow giảm lập chỉ mục, không phải kiểm soát truy cập.
