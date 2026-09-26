# Prompt ส่งต่อให้ AI: โมเดล 3D พีชชี่แบบมีกระดูก (Peachi 3D)

> ก๊อปทุกอย่างใต้เส้นนี้ไปวางให้ AI ตัวอื่นได้เลย แล้วเขียนงานที่ต้องการในบรรทัดสุดท้าย

---

คุณกำลังช่วยพัฒนาเกม **PeachiView Halloween** เป็นเกมผีมุมมองบุคคลที่ 1 ที่เล่นบน browser ใช้ HTML + ES modules + three.js r170 ผ่าน import map และไม่มี build step แผนเกมอยู่ใน `PLAN.md` ส่วน contract ของแต่ละโมดูลอยู่ใน `docs/ARCHITECTURE.md`

มี commit ใหม่ที่เพิ่ม **โมเดล 3D ของ "พีชชี่" แบบมีโครงกระดูก (rigged) พร้อมแอนิเมชัน** ทำตาม `Character_Sheet_1_Peachi.png` (ภาพหน้า ข้าง หลัง และสีหน้า) โมเดลสร้างด้วยสคริปต์ Blender ทั้งหมดโดยไม่มีขั้นตอนปั้นด้วยมือ และต่อเข้าเกมแล้ว ให้อ่านสรุปนี้ก่อนแก้อะไรที่เกี่ยวกับพีชชี่

## 1. ไฟล์ที่เพิ่มและแก้
- `assets/models/peachi.glb`: โมเดลที่เกมใช้จริง ขนาด 5.6 MB บีบอัดแบบ Draco **เป็นไฟล์ที่ generate ขึ้นมา ห้ามแก้ด้วยมือ**
- `assets/models/peachi.blend`: ฉากเดียวกันสำหรับเปิดใน Blender 5.x มี armature ชื่อ `PeachiRig` และแยก 1 Action ต่อ 1 ท่า
- `js/peachi/peachi3d.js` (ใหม่): `loadPeachi()` โหลด GLB และจัดการทุกอย่างตอนรัน ได้แก่ วัสดุ toon/holo, สีหน้า, กะพริบตา, ขยับปาก, หันหน้าตามกล้อง และโหมดผี
- `js/peachi/model.js` (แก้): `buildPeachi()` ตัวเดิมเปลี่ยนชื่อเป็น `buildPeachiProcedural()` ส่วน `buildPeachi()` ตัวใหม่ใช้ contract เดิม แต่สลับไปใช้ GLB เองเมื่อโหลดเสร็จ และมีฟังก์ชันใหม่ `preloadPeachi3D()`
- `peachi-3d.html` (ใหม่): หน้า viewer สำหรับดูและทดสอบโมเดล
- `tools/blender/` (ใหม่): pipeline สร้างโมเดล อธิบายไว้ใน `tools/blender/README.md`
- `docs/ARCHITECTURE.md` (แก้): เพิ่มโมเดล 3D เข้าไปใน contract ของ A
- `docs/PEACHI_3D_AI_PROMPT.md`: ไฟล์นี้
- `.gitignore` (ใหม่): `__pycache__/` และ `*.blend1`
- ไฟล์เกมอื่นไม่ได้แก้ `js/ghosts/peachi.js` กับ `peachi-viewer.html` ยังเรียก `buildPeachi()` เหมือนเดิม แล้วได้โมเดล 3D เองอัตโนมัติ

## 2. ตัวโมเดล
- สูงประมาณ 1.60 m ถึงยอดหัว หูแมวสูงถึงประมาณ 1.66 m เป็นสัดส่วนคนจริง ไม่ใช่ chibi
- จุด origin อยู่ที่พื้นใต้เท้า แกน Y ชี้ขึ้น ตัวละครหันหน้าไปทาง +Z
- มี 94 mesh รวมประมาณ 550k สามเหลี่ยม, 31 วัสดุ, 1 skin และ **กระดูก 124 ชิ้น**
- กระดูกหลักตั้งชื่อแบบ Mixamo แต่ไม่มี prefix `mixamorig:`
  - ลำตัวและหัว: `Hips Spine Spine1 Spine2 Neck Head`
  - แขน (ขึ้นต้นด้วย `Left`/`Right`): `Shoulder Arm ForeArm Hand`
  - นิ้ว: `LeftHandThumb1..3` แบบเดียวกันทั้ง Thumb, Index, Middle, Ring, Pinky
  - ขา (ขึ้นต้นด้วย `Left`/`Right`): `UpLeg Leg Foot ToeBase`
- กระดูกของชิ้นที่แกว่งได้
  - ผม: `HairBangs{L,C,R}_01-02`, `HairFrame{L,R}_01-03`, `HairFront{L,R}_01-05`, `HairSide{L,R}_01-05`, `HairBack{L,C,R}_01-04`
  - กระโปรง: `Skirt0_01-02` ถึง `Skirt7_01-02`
  - สายห้อย: `Strap{FR,BL,BR,SL}_01-03`
- แอนิเมชันมี 11 ท่า: `Idle` 4s, `Walk` 1s, `Wave` 3s, `Peace` 3s, `Float` 3s, `Reach` 2.4s, `Jumpscare` 1.4s, `Cry` 3s, `Angry` 2s, `Cheer` 1.2s, `TPose`
  - `Jumpscare` เล่นครั้งเดียวแล้วค้างท่าสุดท้าย ท่าอื่นวนลูปทั้งหมด
  - การแกว่งของผม กระโปรง และสาย ถูก bake ไว้ในท่าแล้ว ตอนรันไม่มีระบบฟิสิกส์
- หน้าเป็น decal 3 ชิ้น เปลี่ยนสีหน้าด้วยการเลื่อน `map.offset` ไปยังช่องที่ต้องการใน texture atlas
  - `FaceEyes` เป็นตาราง 2×4 มีช่อง `open smile blink wide sad angry half squint`
  - `FaceBrows` ใช้ช่องเดียวกับตา เป็นคิ้วที่วาดทับหน้าม้า
  - `FaceMouth` เป็นตาราง 4×2 มีช่อง `smile open frown fang scream o ah neutral`
  - ชื่อช่องเก็บอยู่ใน glTF extras ชื่อ `atlas_grid` และ `atlas_names`
- ตอนโหลดเข้า three.js จุดในชื่อ mesh จะถูกตัดออก เช่น `Shoe.L` กลายเป็น `ShoeL` ส่วนหูฟังคือ mesh ที่ชื่อขึ้นต้นด้วย `Headphones`

## 3. API ใน three.js (`js/peachi/peachi3d.js`)
```js
import { loadPeachi, EMOTIONS } from './js/peachi/peachi3d.js';
const p = await loadPeachi('assets/models/peachi.glb', { toon: true /*, dracoPath */ });
scene.add(p.object);
p.play('Wave', 0.35);          // crossfade (วินาที); คืนค่าเป็น AnimationAction
p.setEmotion('angry');         // neutral happy smile laugh cry angry(มี 💢) scream surprised smug
p.setExpression('wide', 'o');  // ตั้งตากับปากเองด้วยชื่อช่อง atlas
p.setTalking(true);            // ขยับปากแบบสุ่ม
p.setLookAt(true);             // หมุน Neck/Head หากล้องที่ส่งเข้า update
p.setGhost(1);                 // 0..1: ขาจางหาย ขอบชมพูเรืองแสง ตัวโปร่งใส
p.setRim(0.35);                // ความแรงของ rim light สีชมพู
// ทุกเฟรม: p.update(dt, camera)   (camera ส่ง null ได้)
// ค่าอื่นที่ใช้ได้: p.bones (ชื่อ→Bone), p.mixer, p.clips (รายชื่อท่า), p.skinned, p.uniforms, p.gltf, p.emotion
```
- ต้องเรียก `update()` ทุกเฟรม เพราะเป็นตัวขับ mixer, การกะพริบตา, การขยับปาก และ 💢
- ตอนโหลดจะเปลี่ยนวัสดุตามชื่อ
  - `FaceEyes`, `FaceMouth`, `FaceBrows` เป็น MeshBasicMaterial
  - `Holo*` เป็น MeshPhysicalMaterial แบบ iridescence
  - `Gold` เป็นวัสดุโลหะ
  - `EarGlow` เป็นวัสดุเรืองแสง
  - ที่เหลือเป็น MeshToonMaterial พร้อม shader rim/ghost ที่ฉีดผ่าน `onBeforeCompile`
- คิ้ว (`FaceBrows`) ยังเช็ก depth ตามปกติ แต่ shader ดึงตำแหน่งเข้าหากล้อง 4 cm คิ้วจึงลอยพ้นหน้าม้าแต่ไม่ทะลุกำแพง คิ้วจะจางลงเมื่อหน้าหันออกจากกล้องที่กำลังเรนเดอร์ (คำนวณใน `onBeforeRender`)
- ตัวถอด Draco โหลดจาก CDN jsdelivr เหมือนตัว three.js ใน import map ถ้าจะเล่นแบบ offline ต้องเก็บไฟล์ decoder ไว้ในโปรเจกต์แล้วส่ง `{ dracoPath }`

## 4. การใช้ในเกม (`js/peachi/model.js`)
- `buildPeachi({ ghost = true, use3d = true })` คืนค่า `{ group, setExpression, setPose, setGlow, update(dt, t), dispose }` เหมือนเดิม และเพิ่ม getter `expression`, `pose`, `is3D`
- ฟังก์ชันคืนโมเดล procedural ทันที แล้วสลับเป็น GLB เมื่อโหลดเสร็จ
  - ถ้าโหลดไม่ได้ จะใช้โมเดล procedural ต่อไป
  - ถ้าส่ง `use3d: false` จะใช้ procedural อย่างเดียว
- ค่าที่ส่งต่อไปยังโมเดล 3D
  - `setExpression('happy'|'cry'|'angry'|'scream')` เรียก `setEmotion` ด้วยชื่อเดียวกัน
  - `setPose('idle'|'float'|'reach'|'jumpscare')` เล่นท่า `Idle`/`Float`/`Reach`/`Jumpscare`
  - `setGlow(v)` เรียก `setRim(0.35 + 1.2 * v)`
  - ghost เรียก `setGhost(1)`
  - ในเกมปิด look-at และเรียก `update(dt, null)`
- `preloadPeachi3D(url)` โหลดครั้งเดียวแล้ว cache ไว้ ทุก `buildPeachi()` จึงได้ object ชุดเดียวกัน และมีพีชชี่ได้ทีละตัว (ตอนนี้เกมสร้างตัวเดียวใน `js/main.js`) ถ้าต้องการหลายตัวให้ clone ด้วย `SkeletonUtils.clone`
- ไอเท็มหูฟังที่ผู้เล่นต้องเก็บ (`buildHeadphonesItem()`) ยังเป็นแบบ procedural เหมือนเดิม

## 5. การสร้างโมเดลใหม่
ให้แก้สคริปต์แล้ว build ใหม่ อย่าแก้ `.glb` หรือ `.blend` ตรงๆ
```bash
python tools/blender/make_textures.py
blender --background --factory-startup --python tools/blender/build_peachi.py -- --save assets/models/peachi.blend
```
- สิ่งที่ต้องมี
  - Blender 5.x ซึ่งใช้ numpy และ openvdb ที่มากับ Blender (เครื่องผู้ใช้ติดตั้งไว้ที่ `E:\blender\blender.exe`)
  - Python ที่มี Pillow และ numpy สำหรับ `make_textures.py`
  - build ใช้เวลาประมาณ 1 นาที
- flag ที่มีประโยชน์: `--render DIR --views front,side,back`, `--pose Wave:20`, `--clips Idle,Wave`, `--no-rig`, `--no-export`
- ถ้าจะเทียบกับชีต ใช้ `python tools/blender/compare_ref.py DIR out.png --region head` เพื่อวางภาพเรนเดอร์ทับชีต
- ไฟล์ใน `tools/blender/peachi/`
  - `config.py`: ความสูง ตำแหน่งข้อต่อ และสี
  - `sdf.py`: ปั้นทรงด้วย SDF แล้วสร้าง mesh ด้วย OpenVDB
  - `body.py` และ `build_body.py`: ตัว หัว และมือ (หัว loft จากเส้นขอบหน้าตรงและด้านข้างในชีต)
  - `face.py`: decal หน้า
  - `hair.py`: ผมประมาณ 110 ช่อ จัดทรงด้วย rope sim
  - `headphones.py`, `clothes.py`, `jacket.py`, `shoes.py`: หูฟังและเครื่องแต่งกาย
  - `rig.py`: กระดูกและ skin weights
  - `anim.py`: ทุกท่าเขียนเป็นฟังก์ชันของเวลา
  - `export.py`: export glTF แบบ Draco
- texture 2D สร้างจาก `make_textures.py` และ `tex_outfit.py` แล้วเก็บไว้ใน `tools/blender/tex/`
- เพิ่มท่าใหม่: เขียน `clip_xxx(t)` ใน `anim.py` แล้วใส่ใน dict `CLIPS` ด้วยค่า `'loop'` หรือ `'once'` ถ้าเป็น `'once'` ต้องเพิ่มชื่อท่าใน `ONESHOT` ของ `peachi3d.js` ด้วย
- เพิ่มสีหน้าใหม่: atlas ตาและปากใช้ครบ 8 ช่องแล้ว ต้องขยาย grid ทั้งใน `make_textures.py` และ `face.py` แล้วเพิ่ม preset ใน `EMOTIONS`
- ถ้าเปลี่ยนชื่อกระดูก ชื่อท่า หรือชื่อวัสดุ ต้องแก้ `peachi3d.js` และ `model.js` ให้ตรงกันด้วย

## 6. การทดสอบ
- รัน `python -m http.server 8000` แล้วเปิด `http://localhost:8000/peachi-3d.html`
  - query ที่ใช้ได้: `clip=Wave`, `emo=angry`, `cam=face|front|side|back|three|full`, `ghost=1`, `talk=1`, `outline=0`, `spin=1`, `ui=0`, `t=1.2` (หยุดภาพที่เวลานั้น)
  - เมื่อโหลดเสร็จจะตั้งค่า `window.__ready = true`
  - มี pose mode ให้เลือกกระดูกแล้วลากหมุนได้
- เกมอยู่ที่ `http://localhost:8000/index.html` ถ้าจะทดสอบแบบ headless ให้ทำตาม `docs/ARCHITECTURE.md` (`node tools/smoke.mjs …`)

## 7. ข้อจำกัดที่ยังมี
- หน้าและผมใกล้เคียงชีตแล้วแต่ยังไม่เป๊ะ 100% หน้าม้าบางกว่าชีต และผมด้านข้างฟูน้อยกว่า
- นิ้วในบางท่ายังหยาบ เช่นท่า `Peace`
- ตอนรันไม่มีฟิสิกส์ของผมและกระโปรง
- ในเกมยังไม่มีเส้นขอบ outline มีเฉพาะใน `peachi-3d.html` ที่ใช้ `OutlineEffect`
- โมเดลค่อนข้างหนัก ประมาณ 550k สามเหลี่ยม ชิ้นใหญ่ที่สุดคือผม 73k, ฮู้ด 45k, ตัว 37k, หัว 32k และถุงเท้า 32k ถ้าเครื่องช้าให้ลดค่า decimate ใน builder แล้ว build ใหม่
- ตอน build Blender จะเตือน `Mesh Hand.R is not valid` แต่ export ได้ตามปกติ

งานที่อยากให้ทำต่อ: <เขียนตรงนี้>
