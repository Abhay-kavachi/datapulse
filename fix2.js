const fs = require('fs');

function fixPulseScreen() {
  const file = 'src/components/pulse/PulseScreen.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/const \{ health, regions, metrics, activity \} = data;/g, 'const { health, regions, metrics, activityFeed } = data;');
  content = content.replace(/activity\./g, 'activityFeed.');
  content = content.replace(/"Critical"/g, '"critical"');
  content = content.replace(/"Warning"/g, '"warning"');
  content = content.replace(/"Normal"/g, '"normal"');
  content = content.replace(/metric\.name/g, 'metric.metric');
  content = content.replace(/entry\.description/g, 'entry.message');
  content = content.replace(/region: item\.region/g, 'region: item.region || undefined');
  content = content.replace(/METRIC_LABELS\[metric\.metric\]/g, 'METRIC_LABELS[metric.metric as keyof typeof METRIC_LABELS]');
  content = content.replace(/METRIC_UNITS\[metric\.metric\]/g, 'METRIC_UNITS[metric.metric as keyof typeof METRIC_UNITS]');
  fs.writeFileSync(file, content);
}

fixPulseScreen();
