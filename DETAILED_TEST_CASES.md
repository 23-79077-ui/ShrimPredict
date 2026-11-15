# ShrimPredict — Detailed Test Cases (Extracted from Source Code)

**Purpose:** Formal "Detailed Test Cases" documentation table derived strictly from the actual ShrimPredict repository (PHP backend API, React/Vite frontend, Python/Flask ML API, MySQL schema & seeders, JS files). Every route, field name, validation, and sample value below is traceable to the source files listed.

**Repository root:** `C:\Users\HP\Documents\ShrimPredict`  
**Source branches reviewed:** `main` (commit `1ac9253`)  
**Generated for:** QA / Test team authoring of test execution sheets.

---

## 1. Deployment & Environment Info

### 1.1 Live Hostinger URL / Main Entry Route

| Item | Detail (from code) | Source file |
|------|-------------------|-------------|
| Production deployment target | Hostinger `public_html` via GitHub Actions self-hosted SSH deploy; on push to `main` branch: `cd public_html && git pull origin main` | `.github/workflows/deploy.yml` |
| Deploy secrets | `SSH_HOST`, `SSH_USER`, `SSH_PASSWORD`, `SSH_PORT` | `.github/workflows/deploy.yml` |
| Live / main entry route (production) | Not hard-coded in repo; SPA entry is `public_html/index.html` served by Apache; API under `/api/*.php` | `backend/.htaccess`, `backend/index.php` |
| API health/check route | `GET /api/index.php` → JSON `{"message":"ShrimPredict API is running"}` with CORS headers `Access-Control-Allow-Origin: *` | `backend/index.php` |
| Local development entry | XAMPP Apache + MySQL; serve `backend/` so `/api/*.php` is reachable; frontend Vite dev server at `http://localhost:5173` | `README.md` |
| Local DB connection | `new PDO('mysql:host=localhost;dbname=shrim_predict_db;charset=utf8', 'root', '')` — host `localhost`, database `shrim_predict_db`, user `root`, empty password | `backend/config/database.php` |
| Database name (schema seed) | `CREATE DATABASE IF NOT EXISTS shrim_predict_db; USE shrim_predict_db;` | `database/shrim_predict.sql` |
| Apache rewrite rules | `^/api/` and existing files/folders are NOT rewritten; all other requests route to `index.html` (React Router SPA) | `backend/.htaccess` |
| Axios base URL (frontend) | `baseURL: '/api'` — all frontend API calls go to `/api/<endpoint>.php` | `frontend/src/services/api.js` |
| Login endpoint called by frontend | `POST /api/login.php`; user persisted to `localStorage` key `shrim_user`; logout redirects to `/login` | `frontend/src/context/AuthContext.jsx` |

### 1.2 Flask AI API Bridge Configuration (PHP → Python)

| Item | Detail (from code) | Source file |
|------|-------------------|-------------|
| Flask API script | `ml/wssv_transfer/flask_api.py` (Flask + flask_cors + OpenCV + PIL + TensorFlow/Keras models) | `start_ai_api.bat`, `start_ai_api.ps1`, `scripts/start-api-then-vite.js`, `README.md` |
| Flask bind host/port | `app.run(host=os.getenv("SHRIMP_AI_HOST","127.0.0.1"), port=int(os.getenv("SHRIMP_AI_PORT","5001")))` → default `http://127.0.0.1:5001` | `ml/wssv_transfer/flask_api.py` (line 2661) |
| Flask routes | `GET /` (health), `GET,POST /count` and `/detect-preview` (shrimp presence/count preview), `POST /` / `/predict` / `/scan` / `/pipeline` / `/api/pipeline` / `/api/process` / `/api/scan` (disease prediction), `GET,POST /reload_models` | `ml/wssv_transfer/flask_api.py` |
| PHP Flask base URL resolution | `$FLASK_BASE_URL = getenv('SHRIMP_AI_BASE_URL') ?: (getenv('NGROK_BASE_URL') ?: 'http://127.0.0.1:5001')`; then rtrim `/` | `backend/api/config.php` |
| PHP count endpoint constant | `FLASK_SHRIMP_COUNT_URL = getenv('SHRIMP_AI_COUNT_URL') ?: FLASK_BASE_URL . '/count'` | `backend/api/config.php` |
| PHP disease predict endpoint constant | `FLASK_DISEASE_PREDICT_URL / FLASK_PREDICT_URL = getenv('SHRIMP_AI_API_URL') ?: FLASK_BASE_URL . '/predict'` | `backend/api/config.php` |
| cURL options used by PHP bridge | `CURLOPT_TIMEOUT => 60` (count) / `120` (predict), `CURLOPT_FOLLOWLOCATION => true`, `CURLOPT_POSTREDIR => CURL_REDIR_POST_ALL`, `CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4`, `CURLOPT_SSL_VERIFYPEER => false`, `CURLOPT_SSL_VERIFYHOST => false`, header `ngrok-skip-browser-warning: 1` | `backend/api/disease_scan.php` |
| Env file keys | `.env`: `GEMINI_API_KEY=your_gemini_api_key_here`, `OPENAI_API_KEY=` (empty) | `.env` |
| API key resolution (PHP side) | `backend/config/api_keys.php`: reads `getenv('GEMINI_API_KEY')`/`getenv('OPENAI_API_KEY')`, then parses root `.env` or `backend/.env`; defines constants `GEMINI_API_KEY`, `OPENAI_API_KEY` | `backend/config/api_keys.php` |
| ML model artifacts | `ml/artifacts/best_model.keras`, `efficientnet_v2_disease.keras`, `baseline_model.keras`, `ml/artifacts/wssv_transfer/`, `ml/models/mobilenetv2-7.onnx`, `ml/models/shrimp_presence_model.joblib` | `ml/` directory listing |
| Note (from README) | Local Windows TensorFlow import currently fails with a native DLL error; training/Flask API ready but may need Colab/WSL; disease scan degrades gracefully if Flask API is unavailable | `README.md` |

### 1.3 Exact User Roles in the Database

| Role ID | role_name | description | Source |
|---------|-----------|-------------|--------|
| 1 | `admin` | Administrator role | `database/shrim_predict.sql` `INSERT INTO roles` |
| 2 | `caretaker` | Pond caretaker role | `database/shrim_predict.sql` `INSERT INTO roles` |

`users.role` column (`VARCHAR(20)`, default `'caretaker'`) stores `admin` or `caretaker`. Frontend route guards: `ProtectedRoute role="admin"` for `/admin/*`, `ProtectedRoute role="caretaker"` for `/caretaker/*` (`frontend/src/App.jsx`).

### 1.4 Seeded / Default Test Accounts (for login)

All password hashes below are `$2y$10$...` bcrypt. Note: the seed hash in `users` does NOT match the documented password; `login.php` contains self-healing logic that re-hashes on first successful login with a known default password.

| # | Email | Password (default) | Role | pond_id | Notes |
|---|-------|-------------------|------|---------|-------|

---

## 2. Core System Modules

| # | Module | Owner role(s) | Primary backend API file(s) | Primary frontend page(s) | Core DB tables |
|---|--------|---------------|----------------------------|--------------------------|----------------|
| 1 | Authentication & Role Access | admin, caretaker | `login.php`, `users.php`, `forgot_password.php` | `LoginPage.jsx`, `ForgotPasswordModal.jsx`, `AuthContext.jsx` | `users`, `roles`, `admins`, `pond_caretakers`, `activity_logs` |
| 2 | Pond / Batch Monitoring | admin, caretaker | `ponds.php`, `dashboard.php`, `dashboard_debug.php` | `PondMonitoringPage.jsx`, `MyPondPage.jsx`, `AdminDashboard.jsx`, `CaretakerDashboard.jsx` | `ponds`, `caretaker_ponds`, `users` |
| 3 | ML Shrimp Disease Detection | caretaker (scan), admin (review) | `disease_scan.php`, `shrimp_scan_actions.php`, Flask `flask_api.py` (`/predict`, `/count`) | `DiseaseScanPage.jsx`, `DiseaseReportsPage.jsx`, `diseaseClassifier.js` | `disease_reports` (view `scan_reports`), `shrimp_scan_actions`, `notifications` |
| 4 | Feed Monitoring Analysis (Feeding Records) | caretaker (log), admin (review) | `feeding_records.php` | `FeedingPage.jsx`, `FeedingHistoryPage.jsx` | `feeding_records` (view `feeding_logs_reports`), `ponds` (feed totals synced) |
| 5 | Paper Logsheet OCR Scanning | caretaker | `scan_paper_logsheet.php`, Flask `flask_api.py` (`/scan`, `/pipeline` aliases) | `WaterQualityOcrModal.jsx`, `WaterQualityHistoryModal.jsx` | `water_quality_records` (view `water_quality_reports`) |
| 6 | Water Quality Monitoring & Alerts | caretaker (log), admin (review) | `water_quality_records.php`, `alerts.php`, `notifications.php` | `WaterQualityReportsPage.jsx`, `AlertsPage.jsx` | `water_quality_records`, `alerts`, `ponds` (status updated) |

---

## 3. Module-by-Module Technical Details

Each subsection lists: screens/pages & routes, exact form fields & validations & accepted file types, sample realistic test data, and success behavior.

### 3.1 Authentication & Role Access

**Screens / routes:**
- `GET/POST /api/login.php` — login (JSON body)
- `GET,POST,DELETE /api/users.php` — create/archive/restore/delete caretaker users (admin only)
- `POST /api/forgot_password.php` — password reset
- Frontend: `/login` (`LoginPage.jsx`); protected routes `/admin/*` (admin) and `/caretaker/*` (caretaker) via `ProtectedRoute` (`frontend/src/App.jsx`)

**Login form input fields & validation (`login.php`, `LoginPage.jsx`):**
| Field | Type | Required | Validation / rules |
|-------|------|----------|-------------------|
| `email` | string | Yes | Trimmed; matched `LOWER(email)` vs `users.email`; if not found and email = `caretaker@shrimpredict.com`, retries `cj@gmail.com` |
| `password` | string | Yes | `password_verify()` vs bcrypt `password_hash`; plaintext `hash_equals()` legacy fallback; old-password check against `previous_password_hash` / `password_history_json`; known-default self-heal map for `cj@gmail.com`, `rc@gmail.com`, `re@gmail.com`, `admin@shrimpredict.com`, `cristel@gmail.com` |

**LoginPage.jsx default pre-fill:**
- Admin tab: email `admin@shrimpredict.com`, password `admin123`
- Caretaker tab: email `cj@gmail.com`, password `cj12345`

**Login responses:**
- Success (HTTP 200): `{ success: true, message: 'Login successful', user: {...} }` → frontend stores `data.user` in `localStorage.shrim_user`, redirects admin → `/admin/dashboard`, caretaker → `/caretaker/dashboard`, shows SweetAlert2 "Welcome Back!"
- Invalid credentials (HTTP 401): `{ success: false, message: 'Invalid email or password' }`

### 3.2 Pond / Batch Monitoring

**Screens / routes:**
- `GET,POST /api/ponds.php` — list ponds; create pond
- `GET /api/dashboard.php` — dashboard stats (`?user_id=` or `?caretaker_id=`)
- Frontend: `/admin/ponds` or `/admin/pond-reports` (`PondMonitoringPage.jsx`), `/caretaker/my-pond` (`MyPondPage.jsx`), `/admin/dashboard` (`AdminDashboard.jsx`), `/caretaker/dashboard` (`CaretakerDashboard.jsx`)

**Pond form input fields & validation (`ponds.php` POST):**
| Field | Type | Required | Validation / default |
|-------|------|----------|---------------------|
| `pond_name` | string | Yes | — |
| `temperature` | float | No | `(float)` cast |
| `ph_level` | float | No | `(float)` cast |
| `salinity` | float | No | `(float)` cast |
| `dissolved_oxygen` | float | No | `(float)` cast |
| `water_level` | float | No | `(float)` cast |
| `status` | string | No | Default `'Unmonitored'` (schema); valid values used: `Healthy`, `Warning`, `Critical` |
| `area_sqm` | int | No | Default `500` |
| `stocking_date` | date (Y-m-d) | No | Default `date('Y-m-d')` |
| `growth_percentage` | float | No | — |
| `assigned_caretaker_name` | string | No | — |
| `caretakerId` (internal) | int | No | If set, inserts `caretaker_ponds (user_id, pond_id)` and updates `users.pond_id` |

`ensurePondMonitoringColumns()` auto-migrates `ponds` to add: `area_sqm`, `stocking_date`, `growth_percentage`, `disease_detection`, `disease_confidence`, `harvest_readiness`, `expected_harvest_date`, `feed_today_kg`, `total_feed_kg`, `latest_image`, `assigned_caretaker_name`, `shrimp_weight_g` (default `18.50`), `cycle_target_feed_kg` (default `800.00`), `remaining_feed_kg` (default `155.00`), `is_active` (default 1), `operational_status` (default `'Active'`); drops `location` if present.

**Success behavior (pond create):**
- Transaction inserts into `ponds`, assigns caretaker via `caretaker_ponds`, updates `users.pond_id`
- Creates notification `'Pond Status Logged'`, action_type `'water_quality'`, message `"{actor} created {pondName} (Status: {status}, Growth: {growthPct}%)."`
- Response: `{ success: true, message: 'Pond created successfully', id: <pondId> }`
- GET list joins `caretaker_ponds`/`users` to compute `caretaker_name`, attaches today's feed totals and latest harvest prediction per pond

**Sample seeded ponds (`database/shrim_predict.sql`):**
| pond_name | temperature | ph_level | salinity | dissolved_oxygen | water_level | status |
|-----------|-------------|----------|----------|------------------|-------------|--------|
| Pond A1 | 29.5 | 7.8 | 18.0 | 6.8 | 1.2 | Healthy |
| Pond A2 | 28.8 | 7.6 | 17.5 | 6.5 | 1.1 | Healthy |
| Pond A3 | 30.0 | 7.9 | 18.5 | 6.9 | 1.3 | Healthy |
| Pond B1 | 31.0 | 7.4 | 22.5 | 5.4 | 1.0 | Warning |

### 3.3 ML Shrimp Disease Detection

**Screens / routes:**
- `POST /api/disease_scan.php` — multipart scan (image + metadata)
- Flask `POST /predict` (aliases `/`, `/scan`, `/pipeline`, `/api/pipeline`, `/api/process`, `/api/scan`) — disease inference
- Flask `GET,POST /count` and `/detect-preview` — stage-1 shrimp presence/count preview
- Frontend: `/caretaker/disease-scan` (`DiseaseScanPage.jsx`); admin review `/admin/scan-reports` or `/admin/disease-reports` (`DiseaseReportsPage.jsx`)

**Disease scan form input fields & validation (`disease_scan.php`, `DiseaseScanPage.jsx`):**
| Field | Type | Required | Validation / rules |
|-------|------|----------|-------------------|
| `image` | file (multipart) | **Yes** | `isset($_FILES['image']) && is_uploaded_file()`; sent as `CURLFile` with MIME from `$_FILES['image']['type'] ?: 'image/jpeg'`, filename `$_FILES['image']['name'] ?: 'shrimp-scan.jpg'`; frontend `<input type="file" accept="image/*">` plus camera `capture="environment"`; captured file named `` caretaker-wssv-scan-${Date.now()}.png `` |
| `user_id` | int | No | `is_numeric` → cast int; null allowed |
| `caretaker_name` | string | No | Default `'Caretaker'` |
| `pond_name` | string | No | Default `'Assigned Pond'` |
| `status` | string | No | Default `'Pending'` |
| `enable_additional` | bool | No | `filter_var(..., FILTER_VALIDATE_BOOLEAN)`; forwarded to Flask as `enable_additional=true/false` |

**Stage 1 — Shrimp presence preview (Flask `/count`, called first by PHP):**
- Accept/reject before disease inference:
  - `presence_state === 'uncertain'` or `status === 'uncertain'` → HTTP 400: `'Unable to Identify Shrimp. Please Retake or Upload a Clearer Image.'`
  - `is_cooked` or `status === 'cooked_shrimp'` → HTTP 400: cooked shrimp rejected
  - `!shrimp_detected` → HTTP 400: `'No shrimp detected. Please upload a clear image containing a shrimp.'`
- Frontend additionally blocks on `is_crayfish` (`'A crayfish was detected. Please upload an image of a shrimp.'`)

**Stage 2 — Disease prediction (Flask `/predict`):**
- Flask pipeline: Stage 1 `detect_shrimp()` (shrimp vs not-shrimp, cooked/orange validation via `quality_validator`), then WSSV model inference (EfficientNetB0 transfer model, `ml/artifacts/wssv_transfer/`, image size 224), black-gill specialist (`black_gill_specialist`), desktop model fallback (`desktop_shrimp`), pixel/forest fallback models.
- Flask response fields: `shrimp_detected`, `content_category`, `image_quality`, `prediction`/`disease_name`, `confidence`/`confidence_score`, `status`/`health_status`, `risk_level`, `model_used`, `description`, `recommendation`, `probabilities`, `stage1_details`, `stage2_details`.
- PHP maps Flask output: `diseaseName = prediction['prediction'] ?? prediction['disease_name'] ?? 'Unknown Disease'`; `confidenceScore` from `confidence_score` or `confidence`; `riskLevel` (default `'Low'`); `recommendation`; `status` from `$_POST['status'] ?? 'Pending'`; `healthStatus` from `prediction['status']` or (`riskLevel === 'Low' ? 'Healthy' : 'Diseased'`); `modelUsed` default `'Desktop/Shrimp Trained Model'`.

**Disease classes observed in code (`diseaseClassifier.js` + DB seed):**
- `White Spot Syndrome Virus` / `White Spot Syndrome` → risk `High`, recommendation: isolate pond, stop transfers, increase water quality checks, consult specialist
- `Black Gill Disease` → risk `Medium`
- `Vibriosis` → risk `High`
- `Healthy` / `No WSSV Detected` → risk `Low`
- `Needs Review` → risk `Medium` (retake clearer photo)

**Success behavior (DB + response):**
- `ensureDiseaseReportsSchema($conn)` migrates `disease_reports` to add `model_used`, `health_status`, `description` columns if missing
- `INSERT INTO disease_reports (user_id, caretaker_name, pond_name, disease_name, confidence_score, risk_level, recommendation, status, model_used, health_status, description, image_path, created_at)` — `image_path` stored (from upload handling; typically an `uploads/` path)
- `createNotification($conn, 'Disease Scan Submitted', "...scanned for disease: {diseaseName} ({healthStatus}) using {modelUsed} with {confidenceScore}% confidence.", caretakerName, 'disease_scan', pondName, userId, reportId)`

### 3.4 Feed Monitoring Analysis (Feeding Records)

**Screens / routes:**
- `GET,POST,PUT,DELETE /api/feeding_records.php`
- Frontend: `/admin/feeding` (`FeedingPage.jsx`), `/caretaker/feeding-history` (`FeedingHistoryPage.jsx`)

**Feeding record form input fields & validation (`feeding_records.php` POST):**
| Field | Type | Required | Validation / default |
|-------|------|----------|---------------------|
| `pond_id` | int | **Yes** | FK → `ponds.id` |
| `amount_kg` | decimal | **Yes** | NOT NULL |
| `feed_type` | string | **Yes** | NOT NULL (e.g., `'Starter Feed'`, `'Grower Feed'`) |
| `feeding_time` | string | No | `VARCHAR(20)` |
| `product_code` | string | No | `VARCHAR(20)` |
| `has_vitamin` | tinyint | No | `TINYINT(1) DEFAULT 0` |
| `vitamin_name` | string | No | `VARCHAR(150)` |
| `shrimp_weight_grams` | decimal | No | `DECIMAL(8,2)` |
| `tray_count` | int | No | Default `4` |
| `tray_feed_grams`, `total_tray_feed_grams` | decimal | No | `DECIMAL(10,2)` |
| `broadcast_feed_kg` | decimal | No | `DECIMAL(10,3)` |
| `tray_monitoring_status` | string | No | `VARCHAR(150)` |
| `record_date` | date | No | Default `CURRENT_DATE` |
| `notes` | text | No | — |
| `recorded_by_name` | string | No | `VARCHAR(100)` |
| `user_id` | int | No | FK → `users.id` |

`ensureFeedingTable()` auto-adds all the above columns if missing; `syncPondFeedTotals($conn, $pondId)` updates `ponds.feed_today_kg` (SUM where `record_date = CURDATE()`) and `ponds.total_feed_kg` (all-time SUM).

**Success behavior:**
- Primary insert into `feeding_records` with all fields; fallback insert if some new columns missing
- Response HTTP 201: `{ success: true, message: 'Feeding record saved.', id: <newId> }` (or `'... with fallback insert.'`)
- Notification: `'Feeding Record Logged'`, message `"{cName} logged {amountKg}kg of {productCode} feed for Pond #{pondId} on {recordDate} at {feedingTime}."`, action_type `'feeding'`
- GET filters: `?pond_id=`, `?user_id=`, `?recorded_by_name=`, `?date=`, `?search=`; joins `ponds` for `pond_name`; orders by `record_date DESC, created_at DESC`


### 3.5 Paper Logsheet OCR Scanning (Water Quality OCR)

**Screens / routes:**
- `POST /api/scan_paper_logsheet.php` — OCR/Vision extraction
- Flask `POST /scan` / `/pipeline` / `/api/process` / `/api/scan` aliases in `flask_api.py` (Gemini/OpenAI vision)
- Frontend: `WaterQualityOcrModal.jsx` (used from water quality pages)

**Input fields & validation (`scan_paper_logsheet.php`):**
| Field | Type | Required | Validation / rules |
|-------|------|----------|-------------------|
| `image` or `file` | uploaded file | One required | `$_FILES['image']` or `$_FILES['file']`; must be `is_uploaded_file()` |
| `image` / `image_base64` | string (body) | Alternative | Base64; accepts `data:MIME;base64,...` or raw base64; rejects `blob:` or `http:` prefixes |
| `gemini_api_key` / `openai_api_key` | string | No | Override via `$_POST` or JSON body; else headers `X-Gemini-Api-Key` / `X-OpenAI-Api-Key`; else `GEMINI_API_KEY` / `OPENAI_API_KEY` constants |

- Errors returned with **HTTP 200** (so Axios does not throw): `{ success: false, error: 'NO_IMAGE_PROVIDED', message: 'Please upload or capture a photo of the physical paper logsheet.' }`; `{ error: 'API_KEY_REQUIRED', ... }`; `{ error: 'EXTRACTION_FAILED', ... }`; exceptions `{ error: 'PHP_FATAL_ERROR', file, line, message }`

**OCR system prompt (extracts exactly 4 parameters):**
`dissolved_oxygen`, `water_temp`, `ph_balance`, `salinity` as floats; JSON-only output, no markdown.

### 3.6 Water Quality Monitoring & Alerts

**Screens / routes:**
- `GET,POST,DELETE /api/water_quality_records.php`
- `GET /api/alerts.php`, `GET,POST /api/notifications.php`
- Frontend: `/admin/water-quality-reports` (`WaterQualityReportsPage.jsx`), `WaterQualityOcrModal.jsx`, `WaterQualityHistoryModal.jsx`, `/admin/alerts` (`AlertsPage.jsx`)

**Water quality record input fields & validation (`water_quality_records.php` POST):**
| Field | Type | Required | Validation / default |
|-------|------|----------|---------------------|
| `pond_id` | int | **Yes** | FK → `ponds.id` (NOT NULL) |
| `caretaker_id` | int | No | NULL allowed |
| `recorded_by_name` | string | No | `VARCHAR(100)` |
| `dissolved_oxygen` | decimal | **Yes** | `DECIMAL(5,2) DEFAULT 0.00` |
| `temperature` | decimal | **Yes** | `DECIMAL(5,2) DEFAULT 0.00` |
| `ph_level` | decimal | **Yes** | `DECIMAL(5,2) DEFAULT 0.00` |
| `salinity` | decimal | **Yes** | `DECIMAL(5,2) DEFAULT 0.00` |
| `capture_mode` | enum | No | `ENUM('device_screen','data_sheet','manual') DEFAULT 'device_screen'` |
| `ocr_confidence` | decimal | No | `DECIMAL(5,2)` |
| `image_path` | string | No | `VARCHAR(255)` (uploads to `backend/uploads/water_quality/`) |
| `raw_ocr_text` | text | No | — |
| `notes` | text | No | — |
| `status` | string | No | `VARCHAR(30) DEFAULT 'Safe'` |
| `record_date` | date | **Yes** | NOT NULL |
| `recorded_at` | datetime | **Yes** | NOT NULL |

`ensureWaterQualityTable()` auto-creates `water_quality_records` and the `uploads/water_quality` directory.

**Alert evaluation rules (`evaluateWaterQualityAlerts`):**
| Parameter | Threshold | Severity |
|-----------|-----------|----------|
| DO < 4.0 mg/L | Critical DO | Critical |
| DO < 5.0 mg/L | Low DO | High |
| Temp ≥ 34.0°C | Critical thermal stress | Critical |
| Temp ≥ 32.5°C | Elevated temp warning | Medium |
| Temp < 24.0°C | Low temp | Medium |
| pH < 7.0 or > 8.8 | Critical pH | Critical |
| pH < 7.5 or > 8.5 | Abnormal pH | Medium |
| Salinity < 10.0 or > 35.0 ppt | Extreme salinity | High |
| Salinity < 15.0 or > 28.0 ppt | Sub-optimal salinity | Medium |

Alert inserted into `alerts (pond_id, alert_type='Water Quality', title, message, severity, status='Open')`.

**Pond status update:**
- `newStatus = 'Critical'` if `DO < 4.0 OR temp ≥ 34.0 OR pH < 7.0 OR pH > 8.8`; `'Warning'` if `DO < 5.0 OR temp ≥ 32.5 OR pH < 7.5 OR pH > 8.5`; else `'Healthy'`
- `ponds` table updated (`dissolved_oxygen`, `temperature`, `ph_level`, `salinity`, `status`) only if record is latest (`recordDate >= latestRecordDate`)

### 3.7 Harvest Yield Prediction

**Screens / routes:**
- `GET /api/harvest_predictions.php` (no POST in this file; computes & optionally saves predictions per pond)
- Frontend: `/admin/harvest` (`HarvestPage.jsx`)

**Algorithm constants:**
- `FEED_REFERENCE_KG = 15000`; `TARGET_HARVEST_KG = 11000`; `BASELINE_RATIO = 0.7333333333`
- `PREDICTION_METHOD = 'Caretaker Historical Feed-to-Harvest Baseline'`
- Formula documented in response: `predicted_harvest_kg = total_feed_consumed_kg * (11000 / 15000)`
- Disclaimer: "about 15,000 kg of feed produces around 11 tons of shrimp harvest per pond. Final harvest readiness must be confirmed by the farm administrator."

**`ensureHarvestTables()` auto-migrations on `harvest_predictions`:** adds `total_feed_consumed_kg`, `baseline_ratio`, `baseline_harvest_kg`, `adjusted_harvest_kg`, `predicted_harvest_tons`, `feed_progress_percentage`, `readiness_status` (default `'Not Ready'`), `adjustment_percentage`, `adjustment_reason`, `prediction_method`, `calculated_at`, `created_by`.

**Per-pond prediction fields returned:**
- `estimated_harvest` / `adjusted_harvest_kg`, `predicted_harvest_tons`, `average_weight`, `biomass`, `survival_rate`, `feed_progress_percentage`, `feed_progress_visual_percentage`, `remaining_feed_kg`, `readiness_status`, `culture_days`, `data_completeness_status`, `feeding_record_count`, `last_feeding_date`, `pond_condition_summary` (`'Status: %s, Temp: %s C, pH: %s, Salinity: %s ppt, DO: %s mg/L'`), `recommendation`

**Success behavior:**
- If `$caretakerId <= 0`, `savePrediction()` inserts into `harvest_predictions (pond_id, estimated_harvest, average_weight, biomass, survival_rate, recommendation, prediction_date, ...)`

### 3.8 Report Generation / Admin

**Screens / routes:**
- `GET,POST /api/maintenance_reports.php` — `action: 'create'` with `user_id`, `caretaker_name`, `pond_id`, `pond_name`, `problem_type`, `specific_issue`, `severity_level`, `description`, `suggested_action`, `photo_url`, `video_url`
- `POST /api/upload_report_media.php` — file upload (`file`), allowed images `jpg,jpeg,png,gif,webp` and videos `mp4,webm,mov,avi,mkv`; stored in `backend/uploads/reports/` as `report_<time>_<md5>.<ext>`; returns `file_url`
- `GET /api/disease_reports.php` — disease report list (admin review)
- `GET /api/reports.php`, `GET /api/notifications.php`, `GET /api/backup.php`, `POST /api/contact.php`
- `GET,POST /api/shrimp_scan_actions.php` — admin assigns actions to caretakers (`pond_name`, `scan_date`, `caretaker_user_id`, `caretaker_name`, `admin_name`, `decision`, `status ∈ {Pending, In Progress, Done}`); caretaker updates status via `action=update_status` (cannot revert `Done` → `In Progress`; HTTP 409)
- Frontend: `/admin/reports` (`ReportsPage.jsx`), `/caretaker/reports` (`CaretakerReportsPage.jsx`), `/admin/settings` (`SettingsPage.jsx`), `/admin/users` (`UsersPage.jsx`), `/admin/alerts` (`AlertsPage.jsx`), `/admin/notifications` (`NotificationsPage.jsx`)

**Database views (terminology aliases, `migration_scan_reports_and_constraints.sql`):**
- `scan_reports` = `SELECT * FROM disease_reports`
- `feeding_logs_reports` = `SELECT * FROM feeding_records`
- `harvest_forecast` = `SELECT * FROM harvest_predictions`
- `water_quality_reports` = join of `water_quality_records` + `ponds`
- `pond_reports` = selected pond fields incl. `shrimp_weight_g`, `total_feed_kg`, `cycle_target_feed_kg`, `remaining_feed_kg`, `harvest_readiness`, `expected_harvest_date`

**Seeded admin/system data:**
- `roles`: admin / caretaker
- `admins`: `System Admin` / `admin@shrimpredict.com`
- `system_settings`: `max_ponds=30`, `auto_backup=ON`, `backup_frequency=Weekly`, `last_backup=2026-07-23 10:00:00`, `receive_email_notifications=OFF`, etc.
- `alerts` seed: Water Quality Warning (High), Disease Risk (Critical), etc.
- `notifications` seed: feeding/disease_scan/water_quality notifications for Maria Santos
- `activity_logs`: Admin logged in; Recorded feeding

**Dashboard response (`dashboard.php`):**
- `total_ponds`, `healthy_ponds`, `disease_alerts` (COUNT risk_level='High'), `todays_feeding`, `upcoming_harvest`, `feed_chart { labels[], data[] }`, `recent_activity[]` (feeding logs with title/message/time/pond), `assigned_active_pond_ids[]`

### 3.9 Frontend Route Map (for test navigation)

| Path | Component | Guard |
|------|-----------|-------|
| `/` | `LandingPage` | public |
| `/login` | `LoginPage` (admin/caretaker tabs) | public |
| `/admin/dashboard` | `AdminDashboard` | role=admin |
| `/admin/notifications` | `NotificationsPage` | role=admin |
| `/admin/scan-reports` | `DiseaseReportsPage` | role=admin |
| `/admin/disease-reports` | `DiseaseReportsPage` | role=admin |
| `/admin/water-quality-reports` / `/admin/water-quality` | `WaterQualityReportsPage` | role=admin |
| `/admin/pond-reports` / `/admin/ponds` | `PondMonitoringPage` | role=admin |
| `/admin/feeding` | `FeedingPage` | role=admin |
| `/admin/harvest` | `HarvestPage` | role=admin |
| `/admin/users` | `UsersPage` | role=admin |
| `/admin/alerts` | `AlertsPage` | role=admin |
| `/admin/reports` | `ReportsPage` | role=admin |
| `/admin/settings` | `SettingsPage` | role=admin |

---

## 4. End-to-End (E2E) Workflows

Trace below uses only real endpoints, fields, and DB tables from the codebase.

### Workflow 1 — Farm Staff uploads a shrimp image → ML disease detection → Admin review → Scan action

**Actor:** Farm Staff / Caretaker (`cj@gmail.com` / `cj12345`, role caretaker)

| Step | Action | Request | Expected response / DB assertion |
|------|--------|---------|----------------------------------|
| 1 | Login | `POST /api/login.php` `{ "email":"cj@gmail.com","password":"cj12345" }` | HTTP 200 `{ success:true, user:{ role:'caretaker', id, full_name, pond_id, assigned_ponds[] } }`; `localStorage.shrim_user` set |
| 2 | Open scan page | UI route `/caretaker/disease-scan` (`DiseaseScanPage.jsx`) | Page loads; pond preselected from `user.assigned_ponds[0].pond_name` |
| 3 | Upload/capture shrimp image | `POST /api/disease_scan.php` multipart: `image` (accept `image/*`), `user_id`, `caretaker_name`, `pond_name`, `status='Pending'`, `enable_additional='false'` | Stage 1 calls Flask `POST /count`; if `shrimp_detected=false` → HTTP 400 `'No shrimp detected...'`; if uncertain/cooked → HTTP 400 |
| 4 | Flask disease inference | PHP `curl` `POST http://127.0.0.1:5001/predict` with image + `enable_additional` | Flask JSON: `{ success:true, shrimp_detected:true, disease_name:'White Spot Syndrome', confidence_score:93.00, risk_level:'High', health_status:'Diseased', model_used:'...', recommendation:'...' }` |
| 5 | Save to DB | PHP `INSERT INTO disease_reports (user_id, caretaker_name, pond_name, disease_name, confidence_score, risk_level, recommendation, status, model_used, health_status, description, image_path)` | Row in `disease_reports`; `reportId = lastInsertId()` |
| 6 | Notification | `createNotification(... 'Disease Scan Submitted', action_type='disease_scan', ...)` | Row in `notifications` |
| 7 | Scan result UI | Response `{ success:true, message:'Disease scan completed and saved.', report:{...} }` | SweetAlert/result card shows disease name, confidence, risk badge (High → red), recommendation; history list refreshed (`loadHistory()`) |
| 8 | Admin review | Admin (`admin@shrimpredict.com` / `admin123`) opens `/admin/scan-reports` → `GET /api/disease_reports.php` | Seeded-like row visible: `White Spot Syndrome`, 93.00%, High, Pending |
| 9 | Admin assigns action | `POST /api/shrimp_scan_actions.php` `{ pond_name, scan_date, caretaker_user_id, caretaker_name, admin_name, decision, status:'Pending' }` | Row in `shrimp_scan_actions`; notification `'Admin Action: {pondName}'` to caretaker |
| 10 | Caretaker updates status | `POST /api/shrimp_scan_actions.php` `{ action: 'update_status', id, user_id, status:'In Progress'|'Done' }` | `shrimp_scan_actions.status` updated; cannot revert `Done` → `In Progress` (HTTP 409); notification to admin |

**Test data:** image `test_wssv_shrimp.jpg` / `caretaker-wssv-scan-<ts>.png`; pond `Pond A1`; disease `White Spot Syndrome` / `Black Gill Disease` / `No WSSV Detected`.

### Workflow 2 — Paper logsheet OCR → water quality record → pond status alert → Admin dashboard

**Actor:** Caretaker → Farm Owner/Admin

### Workflow 3 — Feeding record → Harvest yield prediction → Readiness review

**Actor:** Caretaker logs feed → Admin reviews harvest forecast

| Step | Action | Request | Expected response / DB assertion |
|------|--------|---------|----------------------------------|
| 1 | Login as caretaker | `POST /api/login.php` | `user.role='caretaker'` |
| 2 | Log feeding | `POST /api/feeding_records.php` `{ pond_id:1, amount_kg:12.5, feed_type:'Starter Feed', feeding_time:'06:00', product_code:'SF-001', has_vitamin:0, record_date:'2026-07-16', notes:'Morning feeding completed', recorded_by_name:'Maria Santos', user_id:<id> }` | HTTP 201 `{ success:true, message:'Feeding record saved.', id:<id> }`; row in `feeding_records` |
| 3 | Pond feed totals sync | Internal `syncPondFeedTotals()` | `ponds.feed_today_kg` and `ponds.total_feed_kg` updated for pond 1 |
| 4 | Notification | `createNotification('Feeding Record Logged', action_type='feeding', ...)` | Row in `notifications` |
| 5 | Admin harvest forecast | Admin opens `/admin/harvest` → `GET /api/harvest_predictions.php` | PHP computation: `predicted_harvest_kg = total_feed_consumed_kg * (11000/15000)`; per pond: `estimated_harvest`, `predicted_harvest_tons`, `average_weight`, `survival_rate`, `feed_progress_percentage`, `readiness_status`, `recommendation` |
| 6 | Save prediction | If caretaker filter not selected, `savePrediction()` inserts into `harvest_predictions (pond_id, estimated_harvest, average_weight, biomass, survival_rate, recommendation, prediction_date, ...)` | Row in `harvest_predictions`; visible via `harvest_forecast` view |
| 7 | Readiness decision | Admin confirms/rejects harvest based on `readiness_status` and `pond_condition_summary` | Harvest planning action (manual, outside code scope) |

**Test data:** pond `Pond A1`, `amount_kg: 12.50`, `feed_type: 'Starter Feed'`; expected harvested sample from seed: pond 1 → `420.50` kg, `32.0` g avg weight, `88.0%` survival.

### Workflow 4 (bonus) — Full caretaker onboarding & pond creation by admin

| Step | Action | Request | Expected response |
|------|--------|---------|-------------------|
| 1 | Admin creates caretaker user | `POST /api/users.php` `{ action:'create_caretaker', full_name, email, password_hash, role:'caretaker', status:'Active', phone }` | User inserted into `users` |
| 2 | Admin creates pond | `POST /api/ponds.php` `{ pond_name:'Pond D1', temperature:30.0, ph_level:7.8, salinity:20.0, dissolved_oxygen:6.0, water_level:1.1, status:'Unmonitored', area_sqm:500, assigned_caretaker_name:'...' }` | Row in `ponds`; notification `'Pond Status Logged'` |
| 3 | Assign pond to caretaker | `INSERT INTO caretaker_ponds (user_id, pond_id)` + `UPDATE users SET pond_id` | Caretaker sees pond on `/caretaker/dashboard` via `GET /api/dashboard.php?user_id=` |

---

## Traceability Notes

- All PHP API responses are JSON with CORS `Access-Control-Allow-Origin: *`; frontend Axios base is `/api` (`frontend/src/services/api.js`).
- File uploads: disease scans and water-quality images go to `backend/uploads/` (tmp processing); report media goes to `backend/uploads/reports/` with allowed extensions `jpg,jpeg,png,gif,webp,mp4,webm,mov,avi,mkv` (`upload_report_media.php`).
- Default database credentials in `backend/config/database.php`: host `localhost`, db `shrim_predict_db`, user `root`, password `` (empty) — configure per environment before test execution.
- Flask API must be running (`ml/wssv_transfer/flask_api.py` on port 5001, or an ngrok URL set via `SHRIMP_AI_BASE_URL` / `NGROK_BASE_URL`) for disease scan and shrimp-count preview to succeed; otherwise endpoints degrade with clear error responses.
- The seeded password hash in `users` is intentionally non-matching; `login.php` self-heals on first login using the known-default passwords listed in Section 1.4.


| Step | Action | Request | Expected response / DB assertion |
|------|--------|---------|----------------------------------|
| 1 | Login as caretaker | `POST /api/login.php` | `user.role='caretaker'` |
| 2 | Upload paper logsheet photo | `POST /api/scan_paper_logsheet.php` multipart `image`/`file` + vision API key (`GEMINI_API_KEY` or `OPENAI_API_KEY`) | HTTP 200 `{ success:true, model:'gemini-1.5-flash'|'gpt-4o-mini', data:{ dissolved_oxygen:6.5, water_temp:29.0, ph_balance:7.8, salinity:18.0 }, confidence:98.5 }`; or `error:'NO_IMAGE_PROVIDED'` / `API_KEY_REQUIRED` / `EXTRACTION_FAILED` |
| 3 | Save water quality record | `POST /api/water_quality_records.php` `{ pond_id, dissolved_oxygen, temperature, ph_level, salinity, capture_mode:'data_sheet', ocr_confidence, image_path, record_date, recorded_at }` | Row in `water_quality_records`; if latest → `ponds` updated (`dissolved_oxygen`, `temperature`, `ph_level`, `salinity`, `status`) |
| 4 | Alert evaluation | Internal `evaluateWaterQualityAlerts()` | If thresholds breached → row in `alerts (alert_type='Water Quality', severity, status='Open')` |
| 5 | Activity log | `INSERT INTO activity_logs (user_id, action='Water Quality Verified', details)` | Row in `activity_logs` |
| 6 | Admin review | Admin opens `/admin/water-quality-reports` (`GET /api/water_quality_records.php`) and `/admin/dashboard` | `water_quality_reports` view shows the record; dashboard `healthy_ponds` / `disease_alerts` reflect latest state |

**Test data:** DO `6.5` mg/L, Temp `29.0`°C, pH `7.8`, Salinity `18.0` ppt → pond stays `Healthy`; or DO `3.8`, Temp `34.5`, pH `6.9` → `Critical` + Critical alert.

| `/caretaker/dashboard` | `CaretakerDashboard` | role=caretaker |
| `/caretaker/my-pond` | `MyPondPage` | role=caretaker |
| `/caretaker/disease-scan` | `DiseaseScanPage` | role=caretaker |
| `/caretaker/feeding-history` | `FeedingHistoryPage` | role=caretaker |
| `/caretaker/reports` | `CaretakerReportsPage` | role=caretaker |
| `/caretaker/notifications` | `CaretakerNotificationsPage` | role=caretaker |
| `/caretaker/settings` | `CaretakerSettingsPage` | role=caretaker |

- Response: `{ success: true, method, label, formula, historical_baseline, feed_reference_kg, target_harvest_kg, target_harvest_tons, baseline_ratio, disclaimer, selected_caretaker_id, selected_pond_id, ponds[], caretakers[], summary { total_feed_consumed_kg, baseline_harvest_kg, adjusted_harvest_kg, remaining_feed_kg, pond_count, predicted_harvest_tons, average_feed_progress_percentage }, predictions[] }`

**Sample seeded harvest predictions:**
| pond_id | estimated_harvest | average_weight | biomass | survival_rate | recommendation | prediction_date |
|---------|-------------------|----------------|---------|---------------|----------------|-----------------|
| 1 | 420.50 | 32.0 | 1800.0 | 88.0 | Maintain current feeding and water quality. | 2026-09-10 |
| 2 | 360.20 | 29.0 | 1500.0 | 81.0 | Monitor closely for stress signs. | 2026-09-15 |

- Activity log inserted into `activity_logs` (`action: 'Water Quality Verified'/'Water Quality Updated'`)

**Success response:**
- `{ success: true, is_update, message: 'Water quality record for {pondName} ({recordDate}) successfully logged/updated!', data: { id, pond_id, pond_name, dissolved_oxygen, temperature, ph_level, salinity, status, capture_mode, image_path, new_pond_status, record_date, is_latest } }`

**Sample realistic test data:**
- Pond B1: Temp 31.0, pH 7.4, Salinity 22.5, DO 5.4 → status `Warning` (seed)
- Pond C1: Temp 33.2, pH 7.1, Salinity 24.0, DO 4.8 → status `Critical` (seed)
- OCR sample: `dissolved_oxygen: 6.5, water_temp: 29.0, ph_balance: 7.8, salinity: 18.0`

- Gemini models tried in order: `gemini-3.6-flash`, `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-flash-latest`, `gemini-2.0-flash`, `gemini-1.5-flash`
- OpenAI fallback: `gpt-4o-mini`, `response_format: { type: 'json_object' }`, `temperature: 0.0`
- Success: `{ success: true, model: 'gemini-...' | 'gpt-4o-mini', data: { dissolved_oxygen, water_temp, ph_balance, salinity }, confidence: 98.5, message: 'Successfully extracted 4 parameters using Multimodal Vision (X).' }`

**Success behavior (downstream):**
- Frontend `WaterQualityOcrModal` consumes extracted `{ dissolved_oxygen, water_temp, ph_balance, salinity }` and posts to `water_quality_records.php` (see 3.6). OCR result not persisted by `scan_paper_logsheet.php` itself.

**Sample seeded feeding records:**
| pond_id | amount_kg | feed_type | record_date | notes |
|---------|-----------|-----------|-------------|-------|
| 1 | 12.5 | Starter Feed | 2026-07-16 | Morning feeding completed |
| 2 | 11.0 | Grower Feed | 2026-07-16 | Adjusted due to temperature |
| 3 | 9.5 | Grower Feed | 2026-07-16 | Critical water condition |

- Response (HTTP 200): `{ success: true, message: 'Disease scan completed and saved.', preview: {...}, prediction: {...}, report: { id, disease_name, confidence_score, risk_level, recommendation, status, model_used, health_status, description, user_id, caretaker_name, pond_name, image_path } }`
- Failure if Flask unavailable (HTTP 502/503): `{ success: false, message: 'AI disease model is unavailable...', ai_response, raw_response }`; DB save failure (HTTP 500): prediction returned but not saved

**Sample realistic test data (from DB columns / seed):**
- Image: `uploads/sample.jpg`, `uploads/sample2.jpg`; frontend capture `caretaker-wssv-scan-<ts>.png`; ML test images `ml/test_wssv_shrimp.jpg`, `ml/test_healthy_shrimp.jpg`
- `disease_name`: `'White Spot Syndrome'`, `confidence_score`: `93.00`, `risk_level`: `'High'`, `status`: `'Pending'`
- `disease_name`: `'Black Gill Disease'`, `confidence_score`: `74.00`, `risk_level`: `'Medium'`, `status`: `'Reviewed'`
- `caretaker_name`: `'Maria Santos'`, `pond_name`: `'Pond A1'`

| Pond B2 | 30.5 | 7.3 | 21.0 | 5.6 | 0.9 | Warning |
| Pond B3 | 31.5 | 7.5 | 23.0 | 5.2 | 1.1 | Warning |
| Pond C1 | 33.2 | 7.1 | 24.0 | 4.8 | 0.8 | Critical |
| Pond C2 | 32.8 | 7.0 | 23.5 | 4.5 | 0.7 | Critical |
| Pond C3 | 33.5 | 7.2 | 24.5 | 4.6 | 0.9 | Critical |

`system_settings` seeded values include `max_ponds: '30'`, `default_pond_status: 'Unmonitored'`, `target_harvest_age: '120'`, `harvest_ready_percentage: '95'`, `theme: 'Light'`, `language: 'English'`.

- Old password (HTTP 401): `{ success: false, is_old_password: true, email, role, password_changed_at, formatted_changed_at, message }`
- DB connection failure (HTTP 500): `{ success: false, message: 'Database connection failed' }`

**Users management (`users.php`) — admin actions:**
- `action=archive_caretaker`: requires `user_id` (>0), optional `archive_reason` (default `'Resigned'`); sets `users.status='Archived'`, `date_archived=NOW()`, `archive_reason`; deletes `caretaker_ponds` rows; response `'Caretaker archived successfully to repository.'`
- `action=restore_caretaker`: requires `user_id`; sets `status='Active'`, clears archive fields
- `action=delete_user`: requires `user_id`; refuses if `role='admin'` (`'Cannot delete system administrator account.'`)
- `action=create_caretaker` (default): creates caretaker user
- GET returns `users[]` with `performance` sub-object (submitted_feeding_logs, disease_reports_submitted, shrimp_images_uploaded, total_activity_logs, last_activity, attendance_pct, performance_score, star_rating, task_completion, feeding_logs) and `ponds[]` + `summary { total_users, admin_count, caretaker_count, active_count }`

| 7 | Harvest Yield Prediction | admin (review) | `harvest_predictions.php` | `HarvestPage.jsx` | `harvest_predictions` (view `harvest_forecast`), `feeding_records` |
| 8 | Report Generation / Admin | admin | `reports.php`, `maintenance_reports.php`, `backup.php`, `contact.php`, `settings.php`, `archived_caretakers.php`, `notifications.php` | `ReportsPage.jsx` (admin & caretaker), `SettingsPage.jsx`, `UsersPage.jsx`, `NotificationsPage.jsx`, `CaretakerNotificationsPage.jsx` | `maintenance_reports`, `system_settings`, `activity_logs`, `notifications`, `contact_messages`, `harvest_adjustments`, `harvest_history` |
| 9 | Shrimp Count (ML preview) | caretaker | Flask `flask_api.py` (`/count`, `/detect-preview`), `disease_scan.php` (stage-1 preview) | `DiseaseScanPage.jsx` (preview before scan) | — (real-time model response only) |

| 1 | `admin@shrimpredict.com` | `admin123` | admin | NULL | Seeded in `users` AND `admins` tables (`System Admin`, phone `09123456789`). LoginPage admin tab pre-fills this pair. `login.php` repairs the broken demo hash (`$2y$10$M5K8GtBBHdtnI1mQ9JkQ5.0yYvFzu1a3X0u6Q9ipUq4S6HxMQQbb2`) when password `admin123` is supplied. |
| 2 | `caretaker@shrimpredict.com` | `admin123` (self-healed) | caretaker | 1 | Seeded as `Maria Santos`. Same broken-demo-hash self-heal applies. |
| 3 | `cj@gmail.com` | `cj12345` (also `admin123`, `caretaker123`) | caretaker | — | LoginPage caretaker tab pre-fills `cj@gmail.com` / `cj12345`. Listed in `login.php` `$knownValidPasswords` self-heal map (accounts that never changed password). |
| 4 | `rc@gmail.com` | `rc12345` (also `admin123`) | caretaker | — | `login.php` known-valid self-heal map. Referenced by `seed_caretaker_ponds.sql` as user_id 3 `Cristel Javier`. |
| 5 | `re@gmail.com` | `re12345` (also `admin123`) | caretaker | — | `login.php` known-valid self-heal map. |
| 6 | `cristel@gmail.com` | `password123` (also `admin123`, `cristel12345`) | caretaker | — | `login.php` known-valid self-heal map. |

Login validation rules (`backend/api/login.php`):
- Request: `POST` JSON body `{ email, password }`; `email` trimmed, matched case-insensitively (`LOWER(email) = LOWER(:email)`).
- Password verified with `password_verify()` against bcrypt hash; legacy plaintext fallback via `hash_equals()`.
- Special fallback: if email resolves to `caretaker@shrimpredict.com` but no user found, tries `cj@gmail.com`.
- Old-password detection: returns HTTP 401 with `is_old_password: true`, `password_changed_at`, `formatted_changed_at` if the password matches `previous_password_hash` or an entry in `password_history_json`.
- Self-heal: for accounts with empty `password_changed_at`, known defaults (`cj12345`, `admin123`, etc.) are verified, then the hash is re-bcrypted and login succeeds.
- Success response: `{ success: true, message: 'Login successful', user: { id, full_name, email, role, status, phone, position, avatar_path, pond_id, assigned_ponds } }`.
- Frontend redirect on success: `role === 'admin'` → `/admin/dashboard`; else → `/caretaker/dashboard` (`LoginPage.jsx`, `AuthContext.jsx`).
