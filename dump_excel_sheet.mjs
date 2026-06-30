import xlsx from 'xlsx';

const file = '/Users/john/Downloads/GCC HC .xlsx';

try {
    const workbook = xlsx.readFile(file);
    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = xlsx.utils.sheet_to_json(worksheet);
        console.log(`DUMP SHEET: ${sheetName}`);
        console.log(JSON.stringify(rawJson, null, 2));
    });
    process.exit(0);
} catch (e) {
    console.error(e);
    process.exit(1);
}
