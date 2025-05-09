import { exposeBlenderContext } from "./blender/blender-context";
import { exposeThemeContext } from "./theme/theme-context";
import { addThemeEventListeners } from "./theme/theme-listeners";
import { exposeWindowContext } from "./window/window-context";

export default function exposeContexts() {
  exposeThemeContext();
  exposeWindowContext();
  exposeBlenderContext();
  addThemeEventListeners();
}
