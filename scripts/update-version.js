import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJsonPath = join(__dirname, '..', 'package.json');
const versionFilePath = join(__dirname, '..', 'src', 'renderer', 'src', 'version.js');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

const versionFileContent = `export const APP_VERSION = '${version}';\n`;

writeFileSync(versionFilePath, versionFileContent, 'utf-8');

console.log(`Updated version to ${version}`);
