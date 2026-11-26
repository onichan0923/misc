// @description Material 3 Expressive-inspired chat controls and message actions for Android Phoenix.
// @version 0.1.0
// @author onichan0923

(() => {
  const ui = phoenix.ui;
  const schemes = {
    dark: {
      surface: 0xff302c38, text: 0xfff1eaf7, muted: 0xffcfc3d5, outline: 0xff978b9f,
      primary: 0xffd8b9ff, primaryContainer: 0xff533b70, onPrimaryContainer: 0xfff1dbff,
      primaryPressed: 0xff674f84, tertiaryContainer: 0xff633c4e, onTertiaryContainer: 0xffffd8e8,
      tertiaryPressed: 0xff795164, row: 0x16d8b9ff, rowPressed: 0x39d8b9ff,
    },
    light: {
      surface: 0xfff4edf8, text: 0xff201b24, muted: 0xff4e4555, outline: 0xff796d82,
      primary: 0xff684588, primaryContainer: 0xffeedbff, onPrimaryContainer: 0xff34164f,
      primaryPressed: 0xffdfc5f4, tertiaryContainer: 0xffffd8e8, onTertiaryContainer: 0xff471c31,
      tertiaryPressed: 0xffefc3d5, row: 0x15684588, rowPressed: 0x30684588,
    },
  };
  const actionPrefix = "message.actions.";
  const menuRoot = "message.actions.root";
  const actionMatch = { prefix: actionPrefix };
  let scheme;
  let rules = [];
  const watchers = [];

  function isAction(node) {
    const aid = node && node.accessibilityId;
    return typeof aid === "string" && aid.startsWith(actionPrefix) && aid !== menuRoot;
  }

  function styleAction(node, first, last) {
    const top = first ? 20 : 5;
    const bottom = last ? 20 : 5;
    ui.update(node.id, {
      background: scheme.row, activeBackground: scheme.rowPressed,
      radiusTopLeft: top, radiusTopRight: top,
      radiusBottomLeft: bottom, radiusBottomRight: bottom,
    });
  }

  // Consecutive action rows form one shape. Dividers or other siblings start
  // a new group. Preserve the original icon, label and destructive-action color.
  function styleMenuRow(node, includeNeighbors) {
    const parent = node.parent == null ? null : ui.node(node.parent);
    const siblings = parent ? parent.children : [];
    const index = siblings.indexOf(node.id);
    if (index < 0) {
      styleAction(node, true, true);
      return;
    }
    const at = i => i >= 0 && i < siblings.length ? ui.node(siblings[i]) : null;
    const before = at(index - 1);
    const after = at(index + 1);
    styleAction(node, !isAction(before), !isAction(after));
    if (includeNeighbors && isAction(before)) styleAction(before, !isAction(at(index - 2)), false);
    if (includeNeighbors && isAction(after)) styleAction(after, false, !isAction(at(index + 2)));
  }

  function styleSheet(anchor) {
    const id = anchor.kind === "sheet" ? anchor.id : anchor.sheet;
    if (id != null) {
      ui.update(id, { radiusTopLeft: 28, radiusTopRight: 28, handleColor: scheme.primary });
    }
  }

  function tintButtonIcon(node) {
    // Phoenix's search and expression button templates put the icon first.
    if (node.children.length === 0) return;
    const image = ui.node(node.children[0]);
    if (image && (image.kind == null || image.kind === "image")) {
      const tint = node.accessibilityId === "search.entry"
        ? scheme.onPrimaryContainer : scheme.onTertiaryContainer;
      ui.update(image.id, { tint });
    }
  }

  function forLive(match, callback) {
    for (const id of ui.find(match)) {
      const node = ui.node(id);
      if (node) callback(node);
    }
  }

  function watch(match, callback) {
    watchers.push(ui.onNode(match, snapshot => {
      const node = ui.node(snapshot.id);
      if (node && node.accessibilityId === snapshot.accessibilityId) callback(node);
    }));
  }

  function apply(choice) {
    scheme = choice === "light" ? schemes.light : schemes.dark;
    for (const remove of rules) remove();
    rules = [];
    const input = {
      background: scheme.surface, color: scheme.text, placeholderColor: scheme.muted,
      borderWidth: 1, borderColor: scheme.outline, focusBorderColor: scheme.primary, radius: 24,
    };
    // activeRadius is a float on Android. A fractional value also makes older
    // JS bridges encode it as a float when they don't recognize the prop type.
    const search = {
      background: scheme.primaryContainer, activeBackground: scheme.primaryPressed,
      radius: 24, activeRadius: 12.5,
    };
    const expressions = {
      background: scheme.tertiaryContainer, activeBackground: scheme.tertiaryPressed,
      radius: 14, activeRadius: 8.5,
    };
    for (const [match, props] of [
      ["composer", input], ["user_settings_search_input", input],
      ["search.entry", search], ["composer.expressions", expressions],
    ]) {
      rules.push(ui.patchProps(match, props));
      forLive(match, node => ui.update(node.id, props));
    }
    forLive("search.entry", tintButtonIcon);
    forLive("composer.expressions", tintButtonIcon);
    forLive(actionMatch, node => {
      if (node.accessibilityId === menuRoot) styleSheet(node);
      else styleMenuRow(node, false);
    });
  }

  const settings = phoenix.settings.define({
    scheme: {
      type: "select", title: "配色", description: "選擇與 Discord 外觀搭配的配色。",
      default: "dark", options: [{ value: "dark", label: "深色" }, { value: "light", label: "淺色" }],
      onChange: apply,
    },
  });
  watch("search.entry", tintButtonIcon);
  watch("composer.expressions", tintButtonIcon);
  watch(actionMatch, node => {
    if (node.accessibilityId === menuRoot) styleSheet(node);
    else styleMenuRow(node, true);
  });
  apply(settings.scheme);
  phoenix.onUnload(() => {
    for (const remove of watchers) remove();
    for (const remove of rules) remove();
  });
})();
