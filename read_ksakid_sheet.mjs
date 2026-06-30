import xlsx from 'xlsx';

const file = '/Users/john/Downloads/KSAKID HC.xlsx';

try {
    const workbook = xlsx.readFile(file);
    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = xlsx.utils.sheet_to_json(worksheet);
        console.log(`SHEET: ${sheetName}, total rows: ${rawJson.length}`);
        if (rawJson.length > 0) {
            console.log("Row 0 keys:", Object.keys(rawJson[0]));
            console.log("Row 0:", rawJson[0]);
            
            // Print a row with Position = 'TL' if exists
            const tl = rawJson.find(r => JSON.stringify(r).includes('TL'));
            if (tl) console.log("Example TL row:", tl);
        }
    });
    process.exit(0);
} catch (e) {
    console.error(e);
    process.exit(1);
}
