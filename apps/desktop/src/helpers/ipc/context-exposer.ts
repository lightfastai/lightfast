import { exposeAuthContext } from "./auth/auth-context";
import { exposeBlenderContext } from "./blender/blender-context";
import { exposeThemeContext } from "./theme/theme-context";
import { exposeWindowContext } from "./window/window-context";

export default function exposeContexts() {
  exposeThemeContext();
  exposeWindowContext();
  exposeBlenderContext();
  exposeAuthContext();
}
