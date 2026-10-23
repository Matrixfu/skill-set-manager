// T8 实装完整 UI；当前占位 client（保持 ./client 导出可解析、dsh.client 声明有效）。
window.__ModuleLoader__.load({
  id: '@matrixfu/skill-set-manager',
  factory(require) {
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {},
    };
  },
});
