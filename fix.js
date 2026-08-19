const fs = require('fs');

function fixPulseScreen() {
  const file = 'src/components/pulse/PulseScreen.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/data\.activity\b/g, 'data.activityFeed');
  content = content.replace(/"Critical"/g, '"critical"');
  content = content.replace(/"Warning"/g, '"warning"');
  content = content.replace(/"Normal"/g, '"normal"');
  content = content.replace(/m\.name\b/g, 'm.metric');
  content = content.replace(/item\.description\b/g, 'item.message');
  // src/components/pulse/PulseScreen.tsx(127,48): Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  content = content.replace(/region: item\.region/g, 'region: item.region || undefined');
  content = content.replace(/METRIC_LABELS\[m\.metric\]/g, 'METRIC_LABELS[m.metric as keyof typeof METRIC_LABELS]');
  content = content.replace(/METRIC_UNITS\[m\.metric\]/g, 'METRIC_UNITS[m.metric as keyof typeof METRIC_UNITS]');
  fs.writeFileSync(file, content);
}

function fixAnomalyRadar() {
  const file = 'src/components/radar/AnomalyRadar.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/"Active"/g, '"active"');
  content = content.replace(/"Investigating"/g, '"forming"'); // Assuming it was mapped incorrectly
  content = content.replace(/a\.timestamp\b/g, 'a.startTime');
  content = content.replace(/anomaly\.timestamp\b/g, 'anomaly.startTime');
  content = content.replace(/a\.criteria\b/g, 'a.triggeringCriteria');
  content = content.replace(/anomaly\.criteria\b/g, 'anomaly.triggeringCriteria');
  fs.writeFileSync(file, content);
}

fixPulseScreen();
fixAnomalyRadar();
