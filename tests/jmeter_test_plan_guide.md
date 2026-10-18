# Apache JMeter plan guide — real ShrimPredict endpoints

This guide describes how to build and run a real-endpoint test plan. It does not
provide mock listeners, fabricated response data, or a pre-filled results file.
Run the plan only against a local/disposable study environment. The disease-scan
and feed-write endpoints persist files or records; do not load-test production.

## 1. Services and route mapping

| Service | Base URL | Route | Method | Request / purpose | Side effects / cautions |
|---|---|---|---|---|---|
| Local PHP API | `http://127.0.0.1:8000` | `/api/login.php` | `POST` | JSON `{"email":"${email}","password":"${password}"}`; use a dedicated test account. | Authentication request; never put real passwords in a committed JMX or CSV. |
| Local PHP API | `http://127.0.0.1:8000` | `/api/ponds.php` | `GET` | Optional query `user_id=${user_id}` when matching the application’s account/pond context. | Reads real DB state; response may depend on MySQL schema and account permissions. |
| Local PHP API | `http://127.0.0.1:8000` | `/api/feeding_records.php` | `GET` | Optional `user_id=${user_id}`, `pond_id=${pond_id}`, and date filters. | Read-only request. The route may create/upgrade its feeding table before returning. |
| Local PHP API | `http://127.0.0.1:8000` | `/api/feeding_records.php` | `POST` | JSON body below, with a valid disposable test pond/user. | **Writes a feeding record and updates pond feed totals.** Use only for a single controlled functional test, not a sustained read-style load test. |
| Local PHP API | `http://127.0.0.1:8000` | `/api/harvest_predictions.php?caretaker_id=${caretaker_id}` | `GET` | Actual forecast read for a test caretaker. | The PHP implementation saves a prediction when `caretaker_id <= 0`; supply a valid positive test caretaker ID to avoid that save path. The endpoint can create/upgrade harvest tables. |
| Local PHP API | `http://127.0.0.1:8000` | `/api/shrimp_count.php` | `POST` | Multipart form field `image`, containing a real shrimp image; Flask preview/count stage. | Calls Flask/OpenCV inference; no mock response. |
| Local PHP API | `http://127.0.0.1:8000` | `/api/disease_scan.php` | `POST` | Multipart form field `image`, containing a real shrimp image; PHP forwards the image to Flask `/predict`. | **May store the uploaded file and disease-scan report in MySQL.** Use a disposable environment and a small, explicitly approved run. |
| Flask AI API | `http://127.0.0.1:5001` | `/` or `/predict` | `GET` | Service/readiness response. | Health/readiness only; do not count this as disease inference. |
| Flask AI API | `http://127.0.0.1:5001` | `/predict` | `POST` | Multipart form field `image`, containing a real shrimp image. | Actual image pipeline/model call. Response may be a class, quality rejection, no-shrimp result, or model-unavailable error. |

The PHP development-server command is `php -S 127.0.0.1:8000 -t backend` from
the repository root. It serves the real `backend` directory; the PHP routes
require the configured MySQL database and PHP cURL extension. The shipped Vite
proxy in `frontend/vite.config.js` points to the Apache path
`http://localhost/shrim_predict_api/backend/api`, not to port 8000. Configure
the frontend proxy/Apache document root for your own local setup rather than
assuming the development server is already wired into the Vite proxy.

The PHP disease-scan handler reads the AI base URL from `SHRIMP_AI_BASE_URL`
(`http://127.0.0.1:5001` by default) and uses `/predict`. Keep the test within
the local environment; do not point a stress run at a public deployment.

### Real request payloads

Login JSON (store test credentials in a local JMeter property file, not in
version control):

```json
{
  "email": "${email}",
  "password": "${password}"
}
```

Feeding-record JSON (single functional test only; use existing test IDs and
confirm the record is safe to write):

```json
{
  "action": "insert",
  "pond_id": ${pond_id},
  "amount_kg": 0.25,
  "amount_grams": 250,
  "feeding_time": "6:00 AM",
  "product_code": "Starter",
  "vitamin_name": "None",
  "has_vitamin": 0,
  "record_date": "${record_date}",
  "recorded_by_name": "JMeter QA",
  "user_id": ${user_id},
  "tray_count": 4,
  "tray_feed_grams": 20,
  "total_tray_feed_grams": 80,
  "broadcast_feed_kg": 0.17,
  "tray_monitoring_status": "JMeter controlled functional test"
}
```

For both image POST endpoints, configure the HTTP Request sampler **Files
Upload** tab with:

- Parameter name: `image`
- MIME type: `image/jpeg` for a JPEG fixture (or its real MIME type)
- File path: an absolute path to a real shrimp image, e.g.
  `${__P(image,C:\path\to\ShrimPredict\ml\test_wssv_shrimp.jpg)}`
- Send files as multipart/form-data: enabled
- Do not add a manual `Content-Type: multipart/form-data` header; JMeter must
  generate the matching multipart boundary.

The PHP disease-scan handler also saves uploaded scan data and requires the
database. A direct Flask `/predict` request isolates the real inference service
without writing a PHP disease report. The two samplers are different workloads;
label and report them separately.

## 2. Test plan tree

Create a **Test Plan** named `ShrimPredict real-endpoint evaluation`.
Add a **User Defined Variables** element:

| Variable | Example/default | Notes |
|---|---|---|
| `php_host` | `127.0.0.1` | Local PHP server only. |
| `php_port` | `8000` | `backend` document root. |
| `ai_host` | `127.0.0.1` | Local Flask AI service only. |
| `ai_port` | `5001` | Actual Flask inference server. |
| `email` | `${__P(email,)}` | Supply a dedicated test account at runtime. |
| `password` | `${__P(password,)}` | Supply a local, untracked properties file. |
| `user_id` | `${__P(user_id,)}` | Existing test caretaker ID. |
| `caretaker_id` | `${__P(caretaker_id,)}` | Existing positive ID to avoid the forecast-save path. |
| `pond_id` | `${__P(pond_id,)}` | Existing test pond ID. |
| `record_date` | `${__time(yyyy-MM-dd,)}` | Use only for an explicitly authorized write test. |
| `image` | `${__P(image,)}` | Real local shrimp image path. |

Add an **HTTP Request Defaults** element to each thread group (or separate
groups): protocol `http`, server `${php_host}` / `${ai_host}`, and the matching
port. Add **HTTP Header Manager** with `Accept: application/json`; add
`Content-Type: application/json` only to JSON requests. Keep the image-upload
samplers multipart and let JMeter set their content type.

Recommended sampler layout:

1. **PHP read-only integration group**
   - `GET /api/ponds.php` with `user_id=${user_id}`.
   - `GET /api/feeding_records.php` with `user_id=${user_id}&pond_id=${pond_id}`.
   - `GET /api/harvest_predictions.php` with `caretaker_id=${caretaker_id}`.
   - `POST /api/login.php` only if intentionally measuring authentication; use
     the test account and JSON body above.
2. **Flask inference group**
   - `GET /predict` as readiness only (label it `AI readiness — GET`, not
     inference).
   - `POST /predict` with a real image multipart upload.
3. **PHP image integration group**
   - `POST /api/shrimp_count.php` with a real image.
   - `POST /api/disease_scan.php` with a real image only for an approved,
     small-volume test because it can persist both a report and an upload.
4. **Optional feed-write functional group**
   - One thread, one loop, one POST at most, with the disposable test pond/user.
   - Do not include it in the read-only throughput/stress aggregate; it mutates
     application state and affects harvest totals.

Add an **HTTP Request** sampler for each row above. In image POST groups,
configure **Files Upload** as specified above. Set **Connect Timeout** and
**Response Timeout** explicitly (for example, 5,000 ms and 120,000 ms for
inference); image/model latency should not be misreported as a connection
timeout.

## 3. Assertions and listeners

Add to each request:

1. **Response Assertion** on response code: `200` for the success-path sampler.
   Keep negative/invalid-input test samplers in their own group with their
   expected status and do not mix them into the success-rate denominator.
2. **JSON Assertion** for JSON responses. For Flask readiness, assert
   `$.success` is `true` and/or `$.status` is `ready`/`online` only if that is
   the exact response from the selected Flask route/version.
3. For image POSTs, assert the response is valid JSON and contains the actual
   result/status field. Do not require every real image to be classified as
   Healthy/WSSV: poor-quality and no-shrimp responses are valid application
   outcomes, while HTTP/model errors must remain visible as errors.
4. For the PHP login success sampler, assert the response’s actual success
   field and user object using **JSON Assertion** after verifying the current
   response schema. For invalid credentials, use a separate negative test and
   assert the documented rejection, not a successful login.

Add **Summary Report**, **Aggregate Report**, and **View Results Tree** for a
one-user diagnostic run. Use **Simple Data Writer** or the CLI `-l` option to
save CSV output. Disable **View Results Tree** during load runs to avoid the
GUI listener consuming substantial memory. Save the `.jmx` plan and use the
same plan/properties for all comparison runs.

## 4. Workload profile and run protocol

First verify each actual service and route with one request. Start with a
single-user smoke run, then increase concurrent threads gradually (for example
5, then 10) while watching the Flask/PHP/MySQL hosts. Record thread count,
ramp-up, duration, dataset/image, machine specs, model availability, database
state, and application version with each result. Stress testing should be
approved and isolated; no stress level or acceptance limit is encoded in this
repository.

Use a **Thread Group** with:

- Number of Threads (users): the documented study cohort/concurrency.
- Ramp-up Period: spread starts to the documented arrival rate.
- Loop Count or Duration: keep identical between comparable runs.
- `Action to be taken after a Sampler error`: continue for observational load
  tests so all failures are counted; use stop behavior only for a safety test.
- Optional **Uniform Random Timer**: include only when user think-time is part
  of the study workload; record its settings.

Do not use an infinite loop or a default high thread count. Keep health checks,
authenticated reads, and image-inference work separate in the results so the
fast readiness `GET /predict` does not dilute measured image-inference latency.

## 5. CLI report and interpretation

From the repository root, with JMeter on `PATH`:

```powershell
jmeter -n -t tests\shrimppredict_test.jmx -l evaluation_tests\jmeter_results.csv -e -o evaluation_tests\jmeter_html_report
```

The JMX file and `evaluation_tests` output paths must be created before running;
JMeter will not generate a test plan. The dashboard output directory must be
empty or absent. In PowerShell, use the same paths with backslashes. Do not
overwrite results from another run without archiving them and recording the
configuration.

Report at minimum sample count, mean/median/p95 response time (ms), min/max,
throughput (requests/second), error count, and error percentage. Use the
**Aggregate Report** for sampler-level comparisons and the **HTML Dashboard**
for the overall run. Error percentage is the observed failed-sample ratio,
not a target to force to 0%. The JMeter dashboard is not a clinical accuracy
metric; use [`evaluate_models.py`](./evaluate_models.py) with labeled
ground-truth data for model quality.
