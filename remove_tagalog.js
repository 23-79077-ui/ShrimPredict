const fs = require('fs');
const path = require('path');

const filePaths = [
    'backend/api/farm_assistant.php',
    'C:/xampp/htdocs/shrim_predict_api/backend/api/farm_assistant.php'
];

let content = fs.readFileSync(filePaths[0], 'utf8');

// Replacements for Tagalog phrases:
content = content.replace(/Kumusta\s*\{\$caretaker\['full_name'\]\}!/g, "Hello, {$caretaker['full_name']}!");
content = content.replace(/Kumusta,\s*\{\$caretaker\['full_name'\]\}!/g, "Hello, {$caretaker['full_name']}!");
content = content.replace(/Kumusta/gi, "Hello");

fs.writeFileSync(filePaths[0], content, 'utf8');
try {
    fs.writeFileSync(filePaths[1], content, 'utf8');
    console.log("Successfully updated both files.");
} catch (e) {
    console.log("Updated repo file, failed XAMPP: " + e.message);
}
