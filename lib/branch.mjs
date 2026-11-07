import { spawnSync } from 'node:child_process';

export const INTEGRATION_BRANCH = 'feature/integrate_ad_sdk';

function git(project, args, optional = false) {
    const result = spawnSync('git', args, { cwd: project, encoding: 'utf8', timeout: 10000 });
    if (result.error || result.status !== 0) {
        if (optional) return '';
        throw new Error('准备 SDK 接入分支失败：' + (result.error?.message || result.stderr || '').trim());
    }
    return result.stdout.trim();
}

export function ensureIntegrationBranch(project, options = {}) {
    const root = git(project, ['rev-parse', '--show-toplevel']);
    const current = git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], true);
    if (current === INTEGRATION_BRANCH) {
        console.log('SDK 接入分支：' + INTEGRATION_BRANCH);
        return { branch: INTEGRATION_BRANCH, action: 'reuse' };
    }
    const target = git(root, ['rev-parse', '--verify', 'refs/heads/' + INTEGRATION_BRANCH], true);
    const head = git(root, ['rev-parse', '--verify', 'HEAD'], true);
    if (target && target !== head) {
        throw new Error('已有接入分支 ' + INTEGRATION_BRANCH + ' 与当前提交不同。请先核对并切换到该分支，再运行 onboard；现有分支和提交均未修改。');
    }
    const action = target ? 'switch' : 'create';
    if (options['dry-run']) {
        console.log((target ? '将切换到 SDK 接入分支：' : '将创建并切换到 SDK 接入分支：') + INTEGRATION_BRANCH);
        return { branch: INTEGRATION_BRANCH, action };
    }
    git(root, target ? ['switch', INTEGRATION_BRANCH] : ['switch', '-c', INTEGRATION_BRANCH]);
    console.log('SDK 接入分支：' + INTEGRATION_BRANCH);
    return { branch: INTEGRATION_BRANCH, action };
}
