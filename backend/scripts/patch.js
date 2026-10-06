const fs = require('fs');
let file = fs.readFileSync('index.js', 'utf8');

file = file.replace(/res\.status\(201\)\.json\(\{ success: true, handover \}\);/, 
`if (hasMajorIssue) {
      await prisma.vehicle.update({
        where: { noPolisi: noPolisi },
        data: { status: 'Maintenance' }
      });
    }

    res.status(201).json({ success: true, handover });`);

file = file.replace(/if \(status === 'Siap Operasi \(Normal\)'\) \{\s*await sendNotification\(updatedHandover\.id, updatedHandover\.noPolisi, \[\], false, 'RESOLVED'\);\s*\}/,
`if (status === 'Siap Operasi (Normal)') {
      await sendNotification(updatedHandover.id, updatedHandover.noPolisi, [], false, 'RESOLVED');
      await prisma.vehicle.update({ where: { noPolisi: updatedHandover.noPolisi }, data: { status: 'Active' } });
    }`);

fs.writeFileSync('index.js', file);
