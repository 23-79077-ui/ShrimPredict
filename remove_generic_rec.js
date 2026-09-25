const fs = require('fs');
const filePaths = [
    'backend/api/farm_assistant.php',
    'C:/xampp/htdocs/shrim_predict_api/backend/api/farm_assistant.php'
];
let content = fs.readFileSync(filePaths[0], 'utf8');

// The default generic recommendation is likely hardcoded in some responses
content = content.replace(/'recommendation'\s*=>\s*"I only use ShrimPredict database records\."/g, "'recommendation' => null");
content = content.replace(/'recommendation'\s*=>\s*'I only use ShrimPredict database records\.'/g, "'recommendation' => null");
content = content.replace(/"recommendation"\s*=>\s*"I only use ShrimPredict database records\."/g, '"recommendation" => null');
content = content.replace(/"recommendation"\s*=>\s*'I only use ShrimPredict database records\.'/g, '"recommendation" => null');

fs.writeFileSync(filePaths[0], content, 'utf8');
try {
    fs.writeFileSync(filePaths[1], content, 'utf8');
    console.log("Successfully removed generic recommendation from both files.");
} catch (e) {
    console.log("Updated repo file, failed XAMPP: " + e.message);
}
