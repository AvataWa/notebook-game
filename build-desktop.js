'use strict';
const { build, Platform, Arch } = require('electron-builder');
// 子进程需要启动真正的 Electron；当前 Node 驱动变量不能继承到打包工具。
delete process.env.ELECTRON_RUN_AS_NODE;

build({
  projectDir: __dirname,
  targets: Platform.WINDOWS.createTarget(['portable'], Arch.x64),
  config: {
    directories: { output: process.env.DESKTOP_OUTPUT_DIR || 'release' },
    electronDist: process.env.ELECTRON_DIST_DIR
      ? require('node:path').resolve(process.env.ELECTRON_DIST_DIR)
      : undefined
  },
  publish: 'never'
}).then(artifacts => {
  console.log('WINDOWS_BUILD_OK');
  artifacts.forEach(file => console.log(file));
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
