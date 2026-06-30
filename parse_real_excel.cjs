const xlsx = require('xlsx');

const workbook = xlsx.readFile('/Users/john/Downloads/111GCC HC (1).xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rawJsonData = xlsx.utils.sheet_to_json(worksheet);

// Let's print the actual raw keys of the first row
if (rawJsonData.length > 0) {
    console.log("RAW KEYS OF ROW 0:", Object.keys(rawJsonData[0]).map(k => JSON.stringify(k)));
    console.log("RAW ROW 0:", rawJsonData[0]);
}

const jsonData = rawJsonData.map(row => {
    const normalized = {};
    for (const key in row) {
        if (key && typeof key === 'string') {
            normalized[key.trim().toUpperCase()] = row[key];
        }
    }
    return normalized;
});

const baha = jsonData.find(r => r.CRM && r.CRM.trim().toLowerCase() === 'jocc-baha');
console.log("BAHA NORMALIZED:", baha);

