# PeachiView Halloween — ไลฟ์ผี 249 ชั่วโมง

แฟนเกมฮาโลวีนไม่เป็นทางการของ [PeachiView](https://www.youtube.com/@PeachiView249) · ทำโดย **Master Tankhun** (Master Tankhun | Tankhun Gaming)

เกมสยองขวัญปนตลกมุมมองบุคคลที่ 1 บนเบราว์เซอร์: เป็นมอดมือใหม่ที่ต้องเฝ้าบ้านพีชชี่ 3 คืน ก่อนไลฟ์จะยาวครบ 249 ชั่วโมง
แผนทั้งเกมอยู่ใน [PLAN.md](PLAN.md)

## เล่นในเครื่อง

ไม่มีขั้นตอน build เปิดด้วยเว็บเซิร์ฟเวอร์ธรรมดาก็พอ เช่น

```sh
npx serve .
# หรือ
python3 -m http.server 8000
```

แล้วเปิด `http://localhost:8000` (ไมค์ใช้ได้เฉพาะ `localhost` หรือ HTTPS)

## Deploy บน Vercel

1. vercel.com → Add New → Project → import repo นี้
2. Framework Preset: **Other** · Build Command: เว้นว่าง · Output Directory: `.` (root)
3. Deploy

`vercel.json` ตั้ง header ให้ใช้ไมค์ได้และแคชฟอนต์ไว้แล้ว ส่วน `.vercelignore` กันไฟล์สำหรับพัฒนาไม่ให้ขึ้นเว็บ

## พารามิเตอร์ดีบัก

| พารามิเตอร์ | ผล |
|---|---|
| `?autostart=1` | เข้าคืนที่ 1 ทันที (เพิ่ม `&prologue=1` เพื่อเริ่มที่บทนำ) |
| `?skip=prologue` | ข้ามข้อความ DM และบทนำ |
| `?hour=3` | เริ่มคืนที่ชั่วโมงนั้น |
| `?speed=20` | นาฬิกาในเกมเร็วขึ้น 20 เท่า |
| `?god=1` | โดนจับแล้วไม่แพ้ |
| `?post=0` | ปิด post-processing |
