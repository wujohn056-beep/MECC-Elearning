const rawJsonData = [
  { "SD": "IRIS", "SM": "IRIS", "CRM": "JOCC-Baha", "Team": "ME-JOCC20", "Position": "TL" }
];

const jsonData = rawJsonData.map(row => {
    const normalized = {};
    for (const key in row) {
        if (key && typeof key === 'string') {
            normalized[key.trim().toUpperCase()] = row[key];
        }
    }
    return normalized;
});

const accountsToCreate = new Map();

jsonData.forEach(row => {
    const sdValue = row.SD ? String(row.SD).trim() : '';
    const smValue = row.SM ? String(row.SM).trim() : '';
    const tlValue = row.TL ? String(row.TL).trim() : '';
    const teamValue = row.TEAM ? String(row.TEAM).trim() : (row.Team ? String(row.Team).trim() : '');
    const positionValue = row.POSITION ? String(row.POSITION).toUpperCase() : (row.Position ? String(row.Position).toUpperCase() : '');
    const crmValue = row.CRM ? String(row.CRM).trim() : '';

    if (sdValue) {
        const sdId = sdValue.toLowerCase();
        if (!accountsToCreate.has(sdId)) {
            accountsToCreate.set(sdId, {
                crmId: sdValue, role: 'sd', sd: '', sm: '', tl: '', team: ''
            });
        }
    }

    if (smValue) {
        const smId = smValue.toLowerCase();
        if (!accountsToCreate.has(smId)) {
            accountsToCreate.set(smId, {
                crmId: smValue, role: 'sm', sd: sdValue, sm: '', tl: '', team: ''
            });
        } else {
            const existing = accountsToCreate.get(smId);
            if (!existing.sd && sdValue) existing.sd = sdValue;
        }
    }

    if (crmValue) {
        const crmId = crmValue;
        const crmIdLower = crmId.toLowerCase();
        
        let role = 'user';
        if (positionValue === 'TL') role = 'tl';
        if (positionValue === 'SM') role = 'sm';
        if (positionValue === 'SD') role = 'sd';

        const existing = accountsToCreate.get(crmIdLower);
        
        accountsToCreate.set(crmIdLower, {
            crmId: existing?.crmId || crmId,
            role: role !== 'user' ? role : (existing?.role && existing.role !== 'user' ? existing.role : 'user'),
            sd: sdValue || existing?.sd || '',
            sm: smValue || existing?.sm || '',
            tl: tlValue || existing?.tl || '',
            team: teamValue || existing?.team || ''
        });
    }
});

console.log(Array.from(accountsToCreate.values()));
