const fs = require('fs');
const file = 'src/components/radar/AnomalyRadar.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/anomaly\.status === 'Active'/g, "anomaly.status === 'active'");
content = content.replace(/anomaly\.status === 'Investigating'/g, "anomaly.status === 'forming'");
fs.writeFileSync(file, content);
