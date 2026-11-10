# Drive Gallery

Gallery ya wazi ya picha na video. Unaweka files kwenye folder ya Google Drive, na website inajisasisha yenyewe.

```
Google Drive (folder moja)
   ↓ kila dakika 30 (GitHub Actions: scripts/sync.mjs)
Cloudflare R2 (files)  +  Supabase (orodha ya files)
   ↓
Website kwenye Vercel (inasoma orodha, inaonyesha gallery)
```

Hatua zifuatazo zifuate kwa mpangilio.

---

## 1. Supabase (database)

1. Fungua project mpya kwenye supabase.com.
2. **SQL Editor** → bandika yaliyomo ya `supabase/schema.sql` → **Run**.
   (Kama ulishatengeneza table ya `media` ya mwanzo, ondoa `--` kwenye mstari wa `drop table` kwanza.)
3. **Project Settings → API**, nakili:
   - `Project URL`
   - `anon public` key (ya website)
   - `service_role` key (ya sync tu; ni siri kubwa, **usiiweke Vercel wala kwenye code**)

## 2. Cloudflare R2 (picha na video)

1. dash.cloudflare.com → **R2 Object Storage** → **Create bucket** (jina: `gallery`).
2. Bucket → **Settings → Public access** → washa **R2.dev subdomain**. Nakili URL (`https://pub-xxxx.r2.dev`). Hii ni `R2_PUBLIC_URL`.
3. R2 ukurasa mkuu → **Manage API tokens** → **Create API token** → ruhusa **Object Read & Write**, bucket `gallery`. Nakili `Access Key ID` na `Secret Access Key`.
4. Nakili pia **Account ID** (inaonekana upande wa kulia wa ukurasa wa R2).

> `r2.dev` ina limit ya kasi na Cloudflare inaishauri kwa majaribio tu. Kwa matumizi ya kweli, utaunganisha bucket na domain yako mwishoni (hatua 8).

## 3. Google Drive (service account)

1. console.cloud.google.com → tengeneza project mpya.
2. **APIs & Services → Library** → tafuta **Google Drive API** → **Enable**.
3. **IAM & Admin → Service Accounts → Create service account** (jina lolote).
4. Ingia kwenye service account → **Keys → Add key → Create new key → JSON**. File la JSON litashuka. Fungua kwa notepad, nakili **yote**.
5. Nakili email ya service account (inaishia `...iam.gserviceaccount.com`).
6. Kwenye Google Drive: bofya kulia folder ya gallery → **Share** → weka email hiyo kama **Viewer**. Folder inaweza kubaki private.
7. Fungua folder, angalia link: `drive.google.com/drive/folders/XXXXXXXX`. Hiyo `XXXXXXXX` ni `DRIVE_FOLDER_ID`.

## 4. GitHub

1. Tengeneza repo mpya kwenye github.com. **Public inashauriwa**, kwa sababu dakika za GitHub Actions ni bila ukomo kwenye public repo (code haina siri yoyote, siri ziko kwenye Secrets).
2. Pakia project hii:
   ```bash
   git init
   git add .
   git commit -m "gallery"
   git branch -M main
   git remote add origin https://github.com/JINA/REPO.git
   git push -u origin main
   ```
   (Au tumia **Upload files** kwenye GitHub kama huna git. Usipakie `node_modules`.)
3. Repo → **Settings → Secrets and variables → Actions → New repository secret**. Ongeza hizi 9:

   | Secret | Thamani |
   |---|---|
   | `GOOGLE_SERVICE_ACCOUNT_JSON` | yaliyomo yote ya file la JSON |
   | `DRIVE_FOLDER_ID` | ID ya folder |
   | `SUPABASE_URL` | Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
   | `R2_ACCOUNT_ID` | Account ID |
   | `R2_ACCESS_KEY_ID` | Access Key ID |
   | `R2_SECRET_ACCESS_KEY` | Secret Access Key |
   | `R2_BUCKET` | `gallery` |
   | `R2_PUBLIC_URL` | `https://pub-xxxx.r2.dev` |

4. Tab ya **Actions** → **Sync Google Drive** → **Run workflow**. Mara ya kwanza inaweza kuchukua muda kama una video nyingi kubwa. Ikiisha, angalia log: itasema `+N mpya`.

## 5. Vercel (website)

1. vercel.com → **Add New → Project** → chagua repo.
2. **Environment Variables**, weka tatu tu:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_TITLE` (jina la gallery)
3. **Deploy**. Link yako ni `jina.vercel.app`.

## 6. Jaribu

- Weka picha mpya kwenye folder ya Drive → subiri dakika 30 (au bonyeza **Run workflow**) → refresh website (ukurasa unajisasisha kila dakika 1).
- Badilisha picha ile ile Drive (Manage versions → Upload new version) → itasasishwa.
- Futa kwenye Drive → itaondoka kwenye website.

## 7. Mambo ya kuangalia

- **Scheduled workflows** zinazimwa na GitHub kama repo haina shughuli kwa siku 60. Ukiona sync imeacha, fungua Actions na ubonyeze **Enable workflow** (au fanya commit yoyote).
- **Picha za iPhone (HEIC)** hazionyeshwi na browsers nyingi. Zibadilishe kuwa JPG kabla ya kuziweka Drive.
- Sync inasoma folder kuu pamoja na sub-folders zake zote (angalia "Albamu" hapa chini).
- Kinga ya usalama: kama folder ya Drive itarudi tupu ghafla, script haifuti kitu. Weka `ALLOW_EMPTY=1` ukitaka kufuta kila kitu kwa makusudi.
- Gallery inaonyesha vitu 1000 vya hivi karibuni.
- Kuendesha kwenye kompyuta yako: nakili `.env.example` kuwa `.env.local`, jaza, kisha `npm install` na `npm run dev`.

## 8. Domain yako (baadaye)

- **Website:** Vercel → Project → **Settings → Domains** → ongeza domain, kisha fuata maelekezo ya DNS.
- **Picha na video:** domain ikiwa kwenye Cloudflare, R2 bucket → **Settings → Custom domains** → ongeza mfano `media.jinalako.com`. Kisha badilisha secret `R2_PUBLIC_URL` kuwa `https://media.jinalako.com` na uendeshe sync upya (futa rows za `media` kwanza ili URL zote ziandikwe upya, au niambie nikuandikie script ya kuhamisha).

---

## Mbadala wa R2 (kama huna kadi)

Script inafanya kazi na huduma yoyote ya S3. Unaongeza secrets mbili za hiari, `S3_ENDPOINT` na `S3_REGION`, na unatumia secrets zile zile `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` na `R2_PUBLIC_URL` kwa funguo na URL za huduma uliyochagua. `R2_ACCOUNT_ID` haihitajiki.

- **Tigris:** `S3_ENDPOINT=https://t3.storage.dev`, `S3_REGION=auto`.
- **Backblaze B2:** `S3_ENDPOINT=https://s3.REGION.backblazeb2.com`, `S3_REGION=REGION` (mfano `us-west-004`, inaonekana kwenye bucket yako).


---

## Albamu: jinsi ya kupanga gallery

Kila **folder ndogo ya kwanza** ndani ya folder kuu inakuwa **albamu** (sehemu yenye kichwa) kwenye website.

```
Gallery (folder kuu, ndiyo unayoshare)
├── 01 Harusi          →  sehemu ya kwanza, kichwa "Harusi"
├── 02 Safari          →  sehemu ya pili, kichwa "Safari"
└── 03 Familia         →  sehemu ya tatu, kichwa "Familia"
```

- **Mpangilio ni kwa jina.** Drive haitoi API ya mpangilio wa mkono, kwa hiyo weka **namba mwanzoni** mwa jina la folder: `01`, `02`, `03`. Namba hizo hazionekani kwenye website (`01 Harusi` inaonekana `Harusi`). Namba za tarakimu 1 hadi 3 zikifuatwa na nafasi, `-`, `.` au `_` ndizo zinazofichwa. Mwaka kama `2024 Safari` hauguswi.
- **Kubadilisha mpangilio:** badilisha namba kwenye majina ya folders, subiri sync inayofuata.
- **Files ndani ya albamu** pia zinapangwa kwa jina (`1.jpg`, `2.jpg`, `10.jpg`, namba zinahesabiwa vizuri). Ukitaka mpangilio wako, zipe majina yenye namba.
- **Sub-folders ndani ya albamu** zinaingizwa kwenye albamu ile ile (hakuna ngazi ya tatu kwenye website).
- **Files zilizo moja kwa moja kwenye folder kuu** zinaonekana juu kabisa, bila kichwa.
- Albamu zikiwa zaidi ya moja, kuna viungo vya kuruka juu ya ukurasa.


---

## Kuweka kwenye cPanel (website ni static, haihitaji Node.js)

Website sasa ni **static** (HTML + JS) na inasoma orodha ya picha moja kwa moja kutoka Supabase kila mtu anapoifungua. Kwa hiyo **inapakiwa mara moja tu**: ukibadilisha Drive, hakuna cha kupakia upya.

1. Pata `gallery-cpanel.zip` (ni toleo lililojengwa tayari, kwa hiyo hauhitaji kujenga chochote).
2. cPanel → **File Manager** → fungua `public_html` (au folder ya subdomain, mfano `gallery.jinalako.com`).
3. **Upload** zip → bonyeza kulia zip → **Extract** → futa zip. `index.html` iwe moja kwa moja ndani ya folder, siyo ndani ya sub-folder.
4. Bonyeza kulia `config.json` → **Edit** → weka thamani zako:
   ```json
   {
     "supabaseUrl": "https://xxxx.supabase.co",
     "anonKey": "eyJ...anon-public-key",
     "title": "PHOTOS 2026"
   }
   ```
   Tumia **anon public** key tu. `service_role` isiwekwe hapa kamwe.
5. Fungua domain yako kwenye browser. Gallery inapaswa kuonekana.

Weka kwenye **mizizi ya domain au subdomain**, siyo kwenye folder ndogo (`jinalako.com/gallery/`), kwa sababu faili za website zinatafutwa kuanzia mzizi.

Kubadilisha jina la gallery baadaye: hariri `title` kwenye `config.json`, hakuna kingine.
