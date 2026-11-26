// @description Use the Android sans-serif family for Phoenix chat text and selected settings fields.
// @version 0.1.0
// @author onichan0923

(() => {
  const ui = phoenix.ui;
  const font = { fontFamily: "sans-serif" };
  const fields = ["composer", "user_settings_search_input", "settings-account-title"];
  const messageParts = ["message.content:", "message.author:", "message.timestamp:"];
  const removeRules = [];

  // A message's accessibility ID can belong to a container. Its text may be
  // several anonymous children below it, so set the family directly on them.
  function styleMessageChildren(anchor) {
    const live = ui.node(anchor.id);
    if (!live || live.accessibilityId !== anchor.accessibilityId) return;

    const pending = live.children.slice();
    const visited = new Set([live.id]);
    while (pending.length) {
      const id = pending.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      const child = ui.node(id);
      if (!child || child.accessibilityId) continue;

      // Standard builds omit the node kind. In that case only try anonymous
      // leaves inside this message part. Named accessories have their own UI.
      const unknownLeaf = child.kind == null && child.children.length === 0;
      if (child.kind === "text" || child.kind === "markup" || unknownLeaf) {
        ui.update(id, font);
      } else {
        for (const next of child.children) pending.push(next);
      }
    }
  }

  for (const field of fields) {
    removeRules.push(ui.patchProps(field, font));
    for (const id of ui.find(field)) ui.update(id, font);
  }

  for (const prefix of messageParts) {
    const match = { prefix };
    removeRules.push(ui.patchProps(match, font));
    removeRules.push(ui.onNode(match, styleMessageChildren));
    for (const id of ui.find(match)) {
      const node = ui.node(id);
      if (!node || !node.accessibilityId || !node.accessibilityId.startsWith(prefix)) continue;
      ui.update(id, font);
      styleMessageChildren(node);
    }
  }

  phoenix.onUnload(() => {
    for (const remove of removeRules) remove();
  });
})();
