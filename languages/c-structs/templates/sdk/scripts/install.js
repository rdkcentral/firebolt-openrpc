import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');

var dest = process.env.NODE_INSTALL_PATH;
var src = 'src/native/build/' + process.env.TARGET_NAME;

installFiles(src, dest);
function installFiles(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest);
    }

    var entries = fs.readdirSync(src);
    entries.forEach((entry) => {
        const srcPath = path.join(src, entry);
        const destPath = path.join(dest, entry);
        const stat = fs.lstatSync(srcPath);

        if (stat.isFile()) {
            fs.copyFileSync(srcPath, destPath);
        } else if (stat.isDirectory()) {
            installFiles(srcPath, destPath);
        } else if (stat.isSymbolicLink()) {
            if (fs.existsSync(destPath)) {
                fs.unlinkSync(destPath);
	    }
            fs.symlinkSync(fs.readlinkSync(srcPath), destPath);
        }
    });
}
