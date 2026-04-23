import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("demo", {
  platform: process.platform,
});
