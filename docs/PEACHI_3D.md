# Peachi 3D: โมเดลพีชชี่แบบมีกระดูกในเกม

โมเดลพีชชี่กับหูฟังเป็นไฟล์ GLB ที่สร้างจากสคริปต์ Blender (`tools/blender/`) ตามชีต `Character_Sheet_1_Peachi.png` เกมเรียกใช้ผ่าน `buildPeachi()` / `buildHeadphonesItem()` ใน `js/peachi/model.js` เหมือนเดิม

## ไฟล์
| ไฟล์ | คืออะไร |
|---|---|
| `assets/models/peachi.glb` | พีชชี่ 5.8 MB (Draco) สูง 1.60 m หันหน้า +Z origin ที่เท้า กระดูก 124 ชิ้น ท่า 12 ท่า |
| `assets/models/headphones.glb` | หูฟังหูแมวแยกชิ้น 0.17 MB สำหรับไอเท็มคืน 1 |
| `assets/models/peachi.blend` | ไฟล์ Blender สำหรับเปิดดู/แก้ (ไม่ขึ้นเว็บ: อยู่ใน `.vercelignore`) |
| `js/peachi/peachi3d.js` | runtime: `loadPeachi()`, `loadHeadphones()` |
| `js/peachi/model.js` | wrapper `buildPeachi()` / `buildHeadphonesItem()` ท้ายไฟล์ ของเดิมเปลี่ยนชื่อเป็น `buildPeachiProcedural()` / `buildHeadphonesItemProcedural()` |
| `peachi-3d.html` | viewer ของโมเดล 3D (ท่า สีหน้า โหมดผี pose mode) |
| `tools/blender/` | สคริปต์สร้าง GLB ทั้งหมด วิธี build อยู่ใน `tools/blender/README.md` |

## ทำงานกับเกมยังไง
- `buildPeachi({ ghost, use3d = true })` คืนโมเดล procedural ทันที แล้วสลับเป็น GLB เมื่อโหลดเสร็จ ถ้าโหลดไม่ได้จะใช้ procedural ต่อ เรียกกี่ครั้งก็ได้ตัวใหม่ทุกครั้ง (พีชชี่ปลอมใน `fake.js` เป็นอีก instance) ส่วนไฟล์ GLB โหลดครั้งเดียว
- รองรับ API ที่เกมใช้ครบ: `setExpression`, `setPose`, `setGlow`, `setGlowColor`, `setDark`/`dark`, `setDesat`, `setHeadphones`/`headphones`, `lookAt(v)`, `faceAnchor`, `faceHeight`, `update(dt, t)`, `dispose()` และมี getter `expression`, `pose`, `is3D` เพิ่ม
- ท่า: `idle`→`Idle`, `float`→`Float`, `reach`→`Reach`, `stunned`→`Stunned`, `jumpscare`→`Jumpscare` (เล่นครั้งเดียวแล้วค้าง) ถ้า `idle` กับสีหน้า `cry`/`angry` จะเล่นท่า `Cry`/`Angry`
- สีหน้า: `happy` `cry` `angry` (มี 💢) `scream` ชื่ออื่นจะกลายเป็น `happy`
- `faceAnchor` เป็น Object3D ชิ้นเดียวตลอดอายุโมเดล ติดอยู่กลางหน้าและขยับตามหัว ถือ reference ไว้ได้เลย `faceHeight` = 1.435
- โหมดผี: ขาจางหายจากพื้นถึงประมาณ 0.55 m ขอบชมพูเรืองแสงและกะพริบ ตัวสว่างเองเล็กน้อยจึงไม่มืดสนิทในห้องมืด `setDark(1)` ใช้สูตรเดียวกับโมเดลเดิม (เงาดำ) `setDesat(v)` ก็เช่นกัน (สีซีดโทนเย็น)
- `buildHeadphonesItem()` คืนไอเท็มเดิม (หมุน/ลอย/แสงวง) แล้วเปลี่ยนตัวหูฟังเป็น `headphones.glb` ขนาดเท่าเดิม
- ตอนรัน ตัวจะเอนตามทิศที่เคลื่อนที่และหันหัวตาม `lookAt()` เหมือนโมเดลเดิม

## ถ้าจะแก้
- อย่าแก้ไฟล์ .glb ด้วยมือ ให้แก้สคริปต์ใน `tools/blender/` แล้ว build ใหม่ (ประมาณ 1 นาที)
- เพิ่มท่า: เขียน `clip_xxx(t)` ใน `tools/blender/peachi/anim.py` แล้วใส่ใน `CLIPS` จากนั้นเพิ่มชื่อใน `CLIP_OF` ท้าย `model.js` ถ้าเป็นท่าเล่นครั้งเดียวต้องเพิ่มใน `ONESHOT` ของ `peachi3d.js` ด้วย
- เพิ่มสีหน้า: atlas ตาและปากใช้ครบ 8 ช่องแล้ว ต้องขยาย grid ใน `make_textures.py` และ `face.py` แล้วเพิ่มใน `EMOTIONS` (`peachi3d.js`) กับ `EMOTION_OF` (`model.js`)
- ปิดโมเดล 3D ชั่วคราว: `buildPeachi({ ghost, use3d: false })`

## ข้อจำกัด
- ประมาณ 550k สามเหลี่ยมต่อตัว คืน 3 มีสองตัว (ตัวจริงกับตัวปลอม) เครื่องสเปกต่ำอาจหน่วง ถ้าต้องลดให้ลดค่า decimate ใน builder แล้ว build ใหม่
- ตัวถอด Draco โหลดจาก CDN jsdelivr เหมือน three.js ใน import map
- ผมกับกระโปรงแกว่งตามที่ bake ไว้ในท่า ตอนรันไม่มีฟิสิกส์
- ตอนโหลดเกมครั้งแรกจะเห็นโมเดล procedural แวบหนึ่งก่อนสลับเป็น 3D
