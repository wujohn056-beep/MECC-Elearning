import { readFileSync } from 'node:fs';

const templatePath = 'docs/manual-qa-evidence-template.md';
const validatorPath = 'scripts/validate-manual-qa-evidence.mjs';

const template = readFileSync(templatePath, 'utf8');
const validator = readFileSync(validatorPath, 'utf8');

const fail = (message) => {
  throw new Error(message);
};

const extractQuotedArray = (source, name) => {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!match) fail(`Missing array ${name} in ${validatorPath}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
};

const templateRows = new Set(
  template
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && !line.includes('| ---'))
    .map((line) => line.split('|').map((cell) => cell.trim()).filter(Boolean)[0])
    .filter((label) => label && !['Check', 'Requirement', 'Language'].includes(label))
);

const requiredPassRows = extractQuotedArray(validator, 'exactPassRows');
const requiredFields = extractQuotedArray(validator, 'requiredFields');

const missingTemplateRows = requiredPassRows.filter((row) => !templateRows.has(row));
if (missingTemplateRows.length > 0) {
  fail(`Manual QA template is missing required validator row(s): ${missingTemplateRows.join(', ')}`);
}

const templateRowsNotValidated = [...templateRows].filter((row) => (
  row !== 'FCM failure fallback still leaves task accessible' && !requiredPassRows.includes(row)
));
if (templateRowsNotValidated.length > 0) {
  fail(`Manual QA template row(s) are not enforced by validator: ${templateRowsNotValidated.join(', ')}`);
}

const missingRequiredFields = requiredFields.filter((field) => !template.includes(`- ${field}:`));
if (missingRequiredFields.length > 0) {
  fail(`Manual QA template is missing required field(s): ${missingRequiredFields.join(', ')}`);
}

if (!validator.includes("tableRow('FCM failure fallback still leaves task accessible')")) {
  fail('Manual QA validator must explicitly validate the FCM fallback row');
}

if (!templateRows.has('FCM failure fallback still leaves task accessible')) {
  fail('Manual QA template must include the FCM fallback row');
}

console.log('Manual QA template and validator are in sync.');
