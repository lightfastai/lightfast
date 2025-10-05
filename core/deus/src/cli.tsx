#!/usr/bin/env node
import * as React from 'react';
import { render } from 'ink';
import { App } from './components/app.js';

// Render the app
const { waitUntilExit } = render(<App />);

// Wait for exit
waitUntilExit().catch(console.error);
