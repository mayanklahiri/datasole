/**
 * Re-exports build-time constants for public API consumption.
 */
import { BUILD_CONSTANTS } from './build-constants';

export const PROTOCOL_VERSION = BUILD_CONSTANTS.PROTOCOL_VERSION;
export const DEFAULT_WS_PATH = BUILD_CONSTANTS.DEFAULT_WS_PATH;
export const MAX_FRAME_SIZE = BUILD_CONSTANTS.MAX_FRAME_SIZE;
export const COMPRESSION_THRESHOLD = BUILD_CONSTANTS.COMPRESSION_THRESHOLD;
