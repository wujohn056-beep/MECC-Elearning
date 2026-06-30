const xlsx = require('xlsx');
const workbook = xlsx.readFile('/Users/john/Downloads/111GCC HC (1).xlsx');

console.log("SHEET NAMES:", workbook.SheetNames);

for (let i = 0; i < workbook.SheetNames.length; i++) {
    console.log(`\n--- SHEET ${i}: ${workbook.SheetNames[i]} ---`);
    const worksheet = workbook.Sheets[workbook.SheetNames[i]];
    const rawJsonData = xlsx.utils.sheet_to_json(worksheet);
    if (rawJsonData.length > 0) {
        console.log("ROW 0 KEYS:", Object.keys(rawJsonData[0]));
        console.log("ROW 0 DATA:", rawJsonData[0]);
    }
}
