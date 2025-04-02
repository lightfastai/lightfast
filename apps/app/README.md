# TODO

- [ ] Add a compact toast component
- [ ] Create custom Dialog & Command components for EditorCommandDialog.
  - we have commented out the close button in the Dialog component, so we should add it back in.
  - we have made multiple changes to the Command component, so we should create a custom component for the EditorCommandDialog.
- [ ] Fix bug where if Property Inspector is open and I shift highlight on react-flow the property inspector gets highlighted too.
- [ ] Fix functionality in Vec3NumberInput & Vec2NumberInput where we do a quick hax like { x: 0, y: 0, z: 0 } to ensure that the value is not undefined.
- [ ] Fix bug where Displace, Add, and Lookup textures have a hard-coded cachedData.type check in use-validate-edge.tsx to allow more than 1 connections.
