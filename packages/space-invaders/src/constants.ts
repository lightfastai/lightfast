export const BOARD_WIDTH = 224;
export const BOARD_HEIGHT = 256;
export const RENDER_SCALE = 2;

export const FIXED_DT_MS = 1000 / 60;
export const MAX_FRAME_DELTA_MS = 100;
export const MAX_STEPS_PER_FRAME = 5;

export const INVADER_COLUMNS = 11;
export const INVADER_ROWS = 5;
export const INVADER_COUNT = INVADER_COLUMNS * INVADER_ROWS;

export const INVADER_CELL_WIDTH = 16;
export const INVADER_CELL_HEIGHT = 16;
export const INVADER_BLOB_WIDTH = 12;
export const INVADER_BLOB_HEIGHT = 8;

export const PLAYER_WIDTH = 16;
export const PLAYER_HEIGHT = 8;
export const PLAYER_Y = 232;
export const PLAYER_START_X = (BOARD_WIDTH - PLAYER_WIDTH) / 2;
export const PLAYER_MIN_X = 8;
export const PLAYER_MAX_X = BOARD_WIDTH - PLAYER_WIDTH - 8;

export const PLAYER_SHOT_WIDTH = 1;
export const PLAYER_SHOT_HEIGHT = 4;
export const ALIEN_SHOT_WIDTH = 2;
export const ALIEN_SHOT_HEIGHT = 6;

export const RACK_START_X = 24;
export const RACK_START_Y = 72;
export const RACK_WAVE_Y_STEP = 8;
export const RACK_MAX_WAVE_Y_STEPS = 4;
export const RACK_HORIZONTAL_STEP = 2;
export const RACK_DOWN_STEP = 8;
export const RACK_LEFT_PADDING = 8;
export const RACK_RIGHT_PADDING = 8;

export const PLAYER_SPEED_PX_PER_SECOND = 72;
export const PLAYER_SHOT_SPEED_PX_PER_SECOND = -140;
export const ALIEN_SHOT_SPEED_PX_PER_SECOND = 48;

export const RACK_INITIAL_STEP_INTERVAL_MS = 500;
export const RACK_MIN_STEP_INTERVAL_MS = 80;
export const RACK_WAVE_INTERVAL_BONUS_MS = 20;

export const ALIEN_SHOT_ATTEMPT_INTERVAL_MS = 900;
export const PLAYER_HIT_DELAY_MS = 600;
