import { app, Menu, type MenuItemConstructorOptions, shell } from "electron";
import enLocale from "./locales/en.json";

type LocaleKeys = keyof typeof enLocale;

const locales: Record<string, Record<string, string>> = {
  en: enLocale,
};

function resolveLocale(): Record<string, string> {
  const tag = app.getLocale().toLowerCase();
  const base = tag.split("-")[0] ?? "en";
  return locales[tag] ?? locales[base] ?? enLocale;
}

function translate(
  strings: Record<string, string>,
  key: LocaleKeys,
  vars: Record<string, string> = {}
): string {
  const template = strings[key] ?? enLocale[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? "");
}

export interface MenuActions {
  openHud: () => void;
  openSecondary: () => void;
}

export function buildApplicationMenu(actions: MenuActions): Menu {
  const strings = resolveLocale();
  const appName = app.getName();
  const t = (key: LocaleKeys, vars?: Record<string, string>) =>
    translate(strings, key, { appName, ...(vars ?? {}) });

  const isMac = process.platform === "darwin";

  const appMenu: MenuItemConstructorOptions = {
    label: appName,
    submenu: [
      { label: t("app.about"), role: "about" },
      { type: "separator" },
      { label: t("app.services"), role: "services" },
      { type: "separator" },
      { label: t("app.hide"), role: "hide" },
      { label: t("app.hideOthers"), role: "hideOthers" },
      { label: t("app.showAll"), role: "unhide" },
      { type: "separator" },
      { label: t("app.quit"), role: "quit" },
    ],
  };

  const fileMenu: MenuItemConstructorOptions = {
    label: t("file.name"),
    submenu: [
      {
        label: t("file.newSecondary"),
        accelerator: "CmdOrCtrl+N",
        click: actions.openSecondary,
      },
      {
        label: t("file.newHud"),
        accelerator: "CmdOrCtrl+Shift+H",
        click: actions.openHud,
      },
      { type: "separator" },
      { label: t("file.close"), role: "close" },
    ],
  };

  const editMenu: MenuItemConstructorOptions = {
    label: t("edit.name"),
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      ...(isMac
        ? [
            { role: "pasteAndMatchStyle" as const },
            { role: "delete" as const },
            { role: "selectAll" as const },
          ]
        : [
            { role: "delete" as const },
            { type: "separator" as const },
            { role: "selectAll" as const },
          ]),
    ],
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: t("view.name"),
    submenu: [
      { label: t("view.reload"), role: "reload" },
      { label: t("view.forceReload"), role: "forceReload" },
      { label: t("view.toggleDevtools"), role: "toggleDevTools" },
      { type: "separator" },
      { label: t("view.resetZoom"), role: "resetZoom" },
      { label: t("view.zoomIn"), role: "zoomIn" },
      { label: t("view.zoomOut"), role: "zoomOut" },
      { type: "separator" },
      { label: t("view.toggleFullscreen"), role: "togglefullscreen" },
    ],
  };

  const windowMenu: MenuItemConstructorOptions = {
    label: t("window.name"),
    submenu: [
      { label: t("window.minimize"), role: "minimize" },
      { label: t("window.zoom"), role: "zoom" },
      ...(isMac
        ? [
            { type: "separator" as const },
            { label: t("window.bringAllToFront"), role: "front" as const },
          ]
        : [{ label: t("file.close"), role: "close" as const }]),
    ],
  };

  const helpMenu: MenuItemConstructorOptions = {
    label: t("help.name"),
    submenu: [
      {
        label: t("help.learnMore"),
        click: () => {
          void shell.openExternal("https://lightfast.ai");
        },
      },
    ],
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [appMenu] : []),
    fileMenu,
    editMenu,
    viewMenu,
    windowMenu,
    helpMenu,
  ];

  return Menu.buildFromTemplate(template);
}
