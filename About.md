# ShrimPredict

## 1. Project Title & Executive Summary

ShrimPredict is a shrimp farm operations and disease-monitoring platform designed to help administrators and caretakers track pond health, feeding activity, water conditions, disease risk, and harvest readiness. The system blends operational aquaculture management with AI-assisted inspection for shrimp diseases, especially White Spot Syndrome Virus (WSSV), while adding safety checks to reject invalid images such as cooked shrimp.

At its core, the system solves a practical aquaculture problem: farms often need a single place to manage pond status, feeding records, caretakers, alerts, and disease scans while reducing human error and enabling early intervention. The platform targets three main user groups:

- Farm administrators who need dashboards, reports, alerts, and operational oversight
- Pond caretakers responsible for daily feeding, pond monitoring, and on-site image scans
- Aquaculture teams needing disease detection and risk assessment tied to pond and production data

The application is structured around a real-world workflow: collect pond information, record feeding and water quality, scan shrimp images for disease, review alert risk levels, and turn that information into actionable management decisions.

## 2. Core Modules & Features

### 2.1 Admin Dashboard and Management Console

The admin experience is centered around the dashboard in the frontend admin area. The main dashboard aggregates operational metrics such as:

- total pond count
- healthy pond count
- disease alerts
- feeding activity for the day
- upcoming harvest count
- recent activity feed

The dashboard fetches data from backend PHP APIs such as:

- /api/dashboard.php
- /api/feeding_records.php
- /api/disease_reports.php
- /api/ponds.php
- /api/harvest_predictions.php

It uses Chart.js to visualize 7-day feed trends and presents recent action summaries. The admin layout also includes navigation to:

- Pond Monitoring
- Feeding Records
- Harvest Planning
- Users
- Disease Reports
- Alerts
- Notifications
- Settings
- Reports

This is not just a static reporting screen; the dashboard actively polls for updates and refreshes when feed or notification events occur.

### 2.2 Pond Monitoring

The pond monitoring subsystem tracks individual pond entities and their operational health. Each pond record includes:

- pond name
- temperature
- pH
- salinity
- dissolved oxygen
- water level
- status
- area in sqm
- stocking date
- growth percentage
- disease detection label
- disease confidence
- harvest readiness
- expected harvest date
- feed totals
- latest image
- assigned caretaker name

The database schema reflects the importance of operational context: ponds are treated as the primary agricultural unit, and many downstream features (feeding, disease reports, notifications, harvest predictions) link back to pond records.

### 2.3 Feeding Management

Feeding is modeled as a first-class operational workflow. The database stores feeding_records with data such as:

- pond_id
- amount_kg
- feed_type
- feeding_time
- product_code
- has_vitamin
- vitamin_name
- record_date
- notes
- recorded_by_name
- user_id

This enables:

- daily feed logging by caretaker
- feed totals by pond
- date-based filtering
- feed charting over the last 7 days
- detection of inconsistencies or gaps
- feed records tied to the assigned caregiver

The feed data is surfaced in both admin and caretaker interfaces, including dedicated feeding pages and feeding history views.

### 2.4 Disease Reporting and AI Scan Workflow

Disease reporting is a major system capability. The project collects both manually entered disease reports and AI-powered scan submissions. The disease_reports table includes:

- user_id
- caretaker_name
- pond_name
- disease_name
- confidence_score
- risk_level
- recommendation
- status
- image_path
- created_at

The front-end caretaker scan page supports:

- camera capture
- uploaded image selection
- preview of the image
- live count of shrimp before final analysis
- optional additional scan logic
- scan history
- assignment to a pond
- submission to PHP APIs

The AI backend checks for:

- no shrimp detected
- cooked shrimp / invalid food image
- valid shrimp before disease classification
- WSSV, black gill, or healthy classification

### 2.5 White Spot Disease Detection (WSSV)

The ML pipeline is specifically built around White Spot Syndrome Virus detection. The pipeline under ml/wssv_transfer includes:

- prepare_dataset.py
- train_transfer_model.py
- train_unified_disease_model.py
- inference.py
- forest_fallback.py
- black_gill_specialist.py
- quality_validator.py
- flask_api.py

The system identifies the disease classes:

- Healthy
- White Spot Syndrome Virus (WSSV)
- Black Gill
- Cooked Shrimp

This is not a generic image classifier; the scripts specifically normalize labels, prepare datasets, train on disease classes, and infer from uploaded images.

The AI pipeline includes:

- dataset validation
- duplicate removal
- balanced dataset generation
- train/val/test split manifests
- Keras/TensorFlow-based transfer learning with EfficientNet options
- fallback forest classifier for uncertain predictions

### 2.6 Cooked Shrimp Blocking / Invalid Image Guard

A major defensive feature is the invalid-image guard against cooked food shrimp. The code explicitly rejects images that appear to be cooked rather than living shrimp and blocks scanning. This is implemented in the quality and detection pipeline:

- detect_blacklisted_image(...)
- detect_cooked_orange_shrimp(...)
- shrimp_detector logic that identifies cooked shrimp in bounding boxes
- API response field is_cooked_or_invalid
- UI status like “Unavailable to scan: Cooked Shrimp”

This is important because the app addresses false positives where cooked shrimp could otherwise be classified as healthy or disease-free.

### 2.7 Harvest Prediction

The system also contains a harvest prediction module. The database table harvest_predictions stores:

- pond_id
- estimated_harvest
- average_weight
- biomass
- survival_rate
- recommendation
- prediction_date

This allows administrators to estimate farm output and track readiness over time.

### 2.8 Notifications and Alerts

The application includes a notification system with:

- notifications table
- alerts table
- action types like feeding, disease_scan, water_quality
- read/unread status
- user association

The backend notifies relevant users after scans and status changes. Alerts are separate from notifications and include severity levels and risk messages.

### 2.9 Settings and User Roles

The system supports configuration through system_settings and a settings UI. The database includes preferences such as:

- max_ponds
- default_pond_status
- target_harvest_age
- harvest_ready_percentage
- prediction_refresh
- receive_disease_alerts
- receive_harvest_alerts
- receive_feeding_alerts
- theme
- language
- date format
- time format

User roles are defined in the roles table and the app distinguishes:

- admin
- caretaker

This role model is enforced in the frontend route protection logic and in the database design.

## 3. Architecture & Tech Stack

### 3.1 Frontend Architecture

The frontend lives in the frontend directory and is a React + Vite application.

Core technologies:

- React 18.3.1
- Vite 5.4.10
- React Router DOM 6.21.1
- Bootstrap 5.3.3
- Chart.js 3.9.0
- react-chartjs-2
- Axios
- Framer Motion
- SweetAlert2
- react-icons
- Tesseract.js
- @techstark/opencv-js

The frontend is organized by role:

- admin pages
- caretaker pages
- shared components
- layouts
- context providers
- services
- utilities

The main routing is in App.jsx. Protected routes enforce admin or caretaker role access.

### 3.2 Styling and Design System

The UI uses a custom design system built around:

- CSS variables for colors and spacing
- Bootstrap utility classes
- custom CSS architecture in index.css
- dark mode toggle via data-theme on documentElement
- localStorage persistence for theme preference

The actual CSS includes:

- @import for Google Fonts with Poppins
- color variables such as primary, secondary, default surfaces, success, warning, danger
- dark mode selectors like [data-theme="dark"]
- custom dashboard card styles, stat cards, hero sections, and admin shell layouts

The app clearly emphasizes a modern farm management look: dark-mode capable, card-based metrics, soft gradients, and strong typography.

### 3.3 Backend Architecture

The backend is primarily PHP and is centered around:

- backend/index.php
- backend/api/*.php
- backend/config/database.php
- backend/utils/notifications_helper.php

The PHP layer exposes JSON APIs for:

- login
- users
- ponds
- dashboard
- feeding records
- notifications
- disease reports
- disease scan processing
- reports
- harvest predictions
- settings
- water quality records

The backend uses PDO to connect to MySQL and is designed for JSON responses consumed by the React frontend.

### 3.4 Database Architecture

The database is a MySQL schema in database/shrim_predict.sql and is structured around operational entities.

Key tables and relationships:

- roles
  - defines user roles
- admins
  - system administrators
- users
  - tenant/farm users and caretakers
- pond_caretakers
  - legacy or direct mappings of pond assignments
- ponds
  - core production records
- caretaker_ponds
  - many-to-many mapping between users and assigned ponds
- feeding_records
  - linked by pond_id and user_id
- disease_reports
  - stores disease outcomes and risk recommendations
- harvest_predictions
  - stores expected yield and timing
- alerts
  - operational warnings
- notifications
  - user-facing messages
- activity_logs
  - action audit trail
- system_settings
  - user-configurable and runtime settings

The schema is strongly relational: ponds are central, and feeding, harvest, disease, and caretaker data all connect back to them.

### 3.5 AI / ML Architecture

The machine learning layer is housed under ml and ml/wssv_transfer. It contains:

- image preprocessing
- dataset labeling and balancing
- transfer learning scripts
- inference pipelines
- content validation
- quality validation
- blacklisted image matching
- cooked shrimp detection
- forest fallback classification

The project uses Python, OpenCV, Pillow, scikit-learn, and TensorFlow/Keras. The training scripts target WSSV and related disease representations and produce artifacts for inference.

### 3.6 Runtime Pattern

The overall application architecture follows a classic three-layer model:

1. React frontend for rendering, route validation, and user interaction
2. PHP API backend for data access and business logic
3. MySQL database for persistence
4. Python AI service for image analysis and classification

The frontend communicates with the PHP APIs, and some scan actions also invoke a Python Flask AI process.

## 4. Data Flow & Workflows

### 4.1 User Authentication and Access

The app begins with login via the frontend login page. The login API validates user credentials and returns role-specific data. The route protection logic in App.jsx restricts access by role:

- admin routes are only available to users with role === 'admin'
- caretaker routes are only available to users with role === 'caretaker'

This ensures that admin actions and caretaker workflows are separated.

### 4.2 Pond and Operational Data Lifecycle

When a pond is monitored or managed:

- pond data is stored in the ponds table
- assigned caretaker relationships are stored in caretaker_ponds or user.pond_id
- feeding activity is added to feeding_records
- water quality is stored via dedicated water quality endpoints
- system dashboards aggregate those records

The admin dashboard reads all this data and computes metrics, risk indicators, and recent activity.

### 4.3 Feed Logging Workflow

A caretaker or admin logs feed in the UI. The request goes to the appropriate PHP API endpoint, typically feeding_records.php. The backend persists:

- pond identifier
- amount
- feed type
- time/date
- notes
- operator identity

After insertion, the system updates the dashboard feed and notification streams. This means the dashboard reacts to feed changes without requiring a full page reload.

### 4.4 Disease Scan Workflow

This is a central operational process.

1. A caretaker opens the disease scan screen.
2. They either capture a photo or upload an image.
3. The frontend previews the image and calls /api/shrimp_count.php.
4. The backend checks if the image is likely to be a valid shrimp image and whether it is cooked or invalid.
5. If the image is blacklisted or appears cooked, the system blocks the scan and returns is_cooked_or_invalid = true.
6. If the image passes the guard, it is sent to the Python AI analysis service.
7. The ML service runs:
   - shrimp detection
   - image quality checks
   - disease classification
   - confidence scoring
   - risk classification
8. The result is returned to the PHP backend and then to the frontend.
9. The frontend displays the disease result and saves a disease report.

### 4.5 Notification and Alert Generation

After disease scans or feeding actions, notifications are created through helper functions. The system stores messages such as:

- feeding record logged
- disease scan submitted
- pond conditions updated

These are then visible in the notifications UI and may be surfaced to the appropriate user role.

### 4.6 Harvest Planning Workflow

The harvest subsystem reads pond metrics and historical growth data to estimate readiness. The result is stored in harvest_predictions and shown in the harvest page, which enables comparison of pond-specific output and guidance on harvest timing.

## 5. Directory Structure Overview

```text
ShrimPredict/
├── backend/
│   ├── api/
│   │   ├── dashboard.php
│   │   ├── disease_reports.php
│   │   ├── feeding_records.php
│   │   ├── harvest_predictions.php
│   │   ├── notifications.php
│   │   ├── ponds.php
│   │   ├── shrimp_count.php
│   │   ├── users.php
│   │   ├── water_quality_records.php
│   │   └── ...
│   ├── config/
│   │   └── database.php
│   ├── utils/
│   │   └── notifications_helper.php
│   ├── uploads/
│   ├── index.php
│   ├── seed_feeding_records.php
│   └── ...
├── database/
│   ├── shrim_predict.sql
│   ├── migration_*.sql
│   └── seed_caretaker_ponds.sql
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── components/
│   │   ├── context/
│   │   ├── services/
│   │   └── utils/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── ml/
│   ├── wssv_transfer/
│   │   ├── prepare_dataset.py
│   │   ├── flask_api.py
│   │   ├── quality_validator.py
│   │   ├── shrimp_detector.py
│   │   ├── black_gill_specialist.py
│   │   ├── forest_fallback.py
│   │   ├── inference.py
│   │   └── ...
│   ├── artifacts/
│   ├── train_*.py
│   ├── test_*.py
│   └── requirements.txt
├── data/
│   └── shrimp-disease / farm_captured / ...
├── tests/
├── README.md
├── TODO.md
├── TRAINING_PIPELINE_AUDIT.md
├── dataset_augmentation_pipeline.py
├── start_ai_api.bat
├── start_ai_api.ps1
└── pyrightconfig.json
```

### Architectural purpose of the directories

- backend/api: API endpoints for the operational system
- database: schema and migration scripts
- frontend/src: app logic, pages, layouts, and state
- ml: training, evaluation, and prediction resources
- data: disease datasets and local training data
- tests: validation scripts and test hooks
- backend/uploads: user-uploaded image storage
- ml/artifacts: trained model outputs and label metadata

## 6. Current Status & Scope

### 6.1 Fully fleshed out

The project is substantially more than a prototype. The codebase includes:

- role-based frontend routing for admin and caretaker flows
- dashboard metrics for productivity and pond health
- feeding records and history
- user and caretaker management
- notifications and alerts
- disease report persistence
- harvest prediction tracking
- water-quality record support
- image upload workflow and scan UI
- ML disease detection pipeline
- blacklisted image rejection and cooked-shrimp blocking
- custom theming and dark-mode UI

These features indicate that this is a complete farm management and disease-monitoring platform rather than a single-purpose demo.

### 6.2 In progress or environment-dependent

Several parts show that the system is still evolving:

- The README specifically notes that TensorFlow import fails on this machine due to a Windows native DLL initialization issue. This means ML training and local inference may be blocked until the environment is corrected.
- The codebase contains multiple training scripts, migration files, and SQL patches, suggesting a development-history pattern rather than a single polished release.
- Some legacy compatibility is evident: the code includes schema backfill logic for disease_reports and multiple assignments for caretaker mappings.
- The project includes live image-check logic, but the final real-world pipeline requires proper training datasets and model artifacts to reach stable production quality.
- There are multiple model-generation and dataset-preparation scripts, indicating the architecture is preparing for a more mature AI pipeline, but the runtime environment still has operational constraints.

### 6.3 Overall product maturity

As implemented, ShrimPredict is best described as a functional aquaculture intelligence platform with a strong operational foundation and a promising AI disease-detection layer. It is already designed to support real farm workflows, but the ML portion still depends on data quality, environment configuration, and continued training/tuning to become fully production-stable.

---

## Summary

ShrimPredict is a shrimp farm monitoring and disease detection platform built around pond health, feeding records, disease scan workflows, and harvest readiness. It combines a React frontend, PHP/MySQL backend, and Python machine learning pipeline into a single operational system for aquaculture management. Its strongest differentiator is that it does not just record farm data—it actively helps detect disease risk from shrimp images, while also guarding against invalid inputs such as cooked shrimp, making it a practical decision-support system for real-world shrimp farm operations.
