# ShrimPredict

ShrimPredict is a capstone web application for shrimp farm m agement. It includes a React + Vite frontend and a PHP + MySQL backend.

## Structure
- frontend/ - React application
- backend/ - PHP API and upload directory
- database/ - SQL schema and sample data

## Run locally
1. Start Apache and MySQL in XAMPP.
2. Create the database named shrim_predict_db and import database/shrim_predict.sql.
3. Copy the backend folder to C:\xampp\htdocs\shrim_predict_api\backend.
4. From the frontend folder, run:
   - npm install
   - npm.cmd run dev
5. Open http://localhost:5173 for the frontend.
6. API endpoints will be available at http://localhost/shrim_predict_api/backend/api/...

Note: If PowerShell blocks `npm` with a script execution policy error, use `npm.cmd` instead.
