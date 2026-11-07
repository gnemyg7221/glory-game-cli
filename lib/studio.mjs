import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function openAndroidStudio(projectPath, options = {}) {
    const path = resolve(projectPath);
    if (!existsSync(join(path, 'gradlew')) || !existsSync(join(path, 'settings.gradle'))) {
        throw new Error('不是完整的 Android Studio 工程：' + path);
    }
    if (options['no-open']) return false;
    if (options['dry-run']) {
        console.log('将用 Android Studio 打开：' + path);
        return false;
    }
    const app = options.studioPath || 'Android Studio';
    const result = (options.opener || spawnSync)('/usr/bin/open', ['-a', app, path], {
        encoding: 'utf8', timeout: 15000,
    });
    if (result.error || result.status !== 0) {
        throw new Error('工程已生成，但未能打开 Android Studio：' + (result.error?.message || result.stderr || '') + '\n工程：' + path);
    }
    console.log('已打开 Android Studio：' + path);
    return true;
}
