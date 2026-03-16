import electronIsDev from 'electron-is-dev';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RESOURCES_PATH = electronIsDev
    ? path.join(__dirname, '../../assets')
    : path.join(process.resourcesPath, 'assets');
const userData = app.getPath('userData');
const DB_PATH = path.join(userData, 'databases');
function createAppPaths(paths) {
    paths.map(path => {
        if (!fs.existsSync(path)) {
            fs.mkdir(path, { recursive: true }, err => {
                if (err)
                    throw err;
                console.log(`Path --${path}-- Created Successfully`);
            });
        }
    });
}
createAppPaths([DB_PATH]);
export { __dirname, RESOURCES_PATH, DB_PATH };
