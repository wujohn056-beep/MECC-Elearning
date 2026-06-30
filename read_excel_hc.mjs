import xlsx from 'xlsx';
import fs from 'fs';

const files = [
    '/Users/john/Downloads/GCC HC .xlsx',
    '/Users/john/Downloads/KSAKID HC.xlsx'
];

files.forEach(file => {
    if (!fs.existsSync(file)) {
        console.log(`File does not exist: ${file}`);
        return;
    }
    console.log(`Reading file: ${file}`);
    try {
        const workbook = xlsx.readFile(file);
        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const rawJson = xlsx.utils.sheet_to_json(worksheet);
            console.log(`  Sheet: ${sheetName}, total rows: ${rawJson.length}`);
            
            // Search for some key names
            const matches = rawJson.filter(row => {
                const rowStr = JSON.stringify(row).toLowerCase();
                return rowStr.includes('yusranasr') || rowStr.includes('ahmadzoubi') || rowStr.includes('jocc27');
            });
            if (matches.length > 0) {
                console.log(`    Found matches in sheet ${sheetName}:`, JSON.stringify(matches.slice(0, 3), null, 2));
            }
        });
    } catch (e) {
        console.error(`Error reading ${file}:`, e);
    }
});
