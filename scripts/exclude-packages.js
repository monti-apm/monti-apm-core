const fs = require('fs');
const execSync = require('child_process').execSync;

const packages = process.argv.slice(2);

const packageJSON = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

packages.forEach((packageName) => {
  delete packageJSON.dependencies[packageName];
  delete packageJSON.devDependencies[packageName];
});

fs.writeFileSync('package.json', JSON.stringify(packageJSON, null, 2), 'utf-8');

execSync('npm install', { stdio: 'inherit' });
