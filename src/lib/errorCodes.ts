/**
 * Error codes and descriptions for Husqvarna mowers
 */

const ERROR_CODES: Record<number, string> = {
  0: 'No error',
  1: 'Unexpected error',
  2: 'Outside working area',
  3: 'No loop signal',
  4: 'Wrong loop signal',
  5: 'Charging station blocked',
  6: 'Trapped',
  7: 'Upside down',
  8: 'Empty battery',
  9: 'Stuck in charging station',
  10: 'Collision sensor problem',
  11: 'Mower switched off',
  12: 'No drive',
  13: 'Lifted',
  14: 'Stuck',
  15: 'Blade motor blocked',
  16: 'Invalid PIN code',
  17: 'Need manual charging',
  18: 'Power board error',
  19: 'Temporary battery problem',
  20: 'Wheel motor blocked right',
  21: 'Wheel motor blocked left',
  22: 'Charging current too high',
  23: 'Electronic problem',
  24: 'Cutting system error',
  25: 'Cutting system imbalance',
  26: 'Tilt sensor error',
  27: 'Wheel sensor error',
  28: 'Alarm! Mower lifted',
  29: 'Communication error',
  30: 'Communication error',
  31: 'Stop button problem',
  32: 'Tilt sensor problem',
  33: 'Mower tilted',
  34: 'Cutting stopped - slope too steep',
  35: 'Wheel motor overloaded right',
  36: 'Wheel motor overloaded left',
  37: 'Charging system problem',
  38: 'Ultrasonic problem',
  39: 'GPS navigations problem',
  40: 'GPS tracking problem',
  41: 'Power supply problem',
  42: 'Loop signal error',
  43: 'Guide 1 not found',
  44: 'Guide 2 not found',
  45: 'Guide 3 not found',
  46: 'Difficult finding home',
  47: 'Boundary sensor problem',
  48: 'Boundary difficult to find',
  49: 'No response from base station',
  50: 'Base station inaccessible',
  51: 'Front wheel drive problem',
  52: 'Alarm! Mower stopped',
  53: 'Alarm! Mower tilted',
  54: 'Alarm! Mower in motion',
  55: 'Alarm! Outside geofence',
  56: 'Poor GPS signal',
  57: 'Guide calibration failed',
  58: 'Guide calibration complete',
  59: 'Temporary problem with charging station',
  60: 'Temporary battery problem',
  61: 'Temporary battery problem',
  62: 'Temporary battery problem',
  63: 'Temporary battery problem',
  64: 'Temporary battery problem',
  65: 'Temporary battery problem',
  66: 'Battery problem',
  67: 'Battery problem',
  68: 'Temporary battery problem',
  69: 'Alarm! Mower switched off',
  70: 'Alarm! Mower stopped',
  71: 'Alarm! Alarm! Mower lifted',
  72: 'Alarm! Mower tilted',
  73: 'Alarm! Mower in motion',
  74: 'Alarm! Outside geofence',
  75: 'Connection problem',
  76: 'Connection settings restored',
  77: 'Zone generator problem',
  78: 'Wheel drive problem',
  79: 'Wheel drive problem',
  80: 'Cutting system imbalance',
  81: 'Safety function problem',
  82: 'Wheel drive problem',
  83: 'Wheel drive problem',
  84: 'Cutting system problem',
  85: 'Wheel drive problem',
  86: 'Wheel drive problem',
  87: 'Cutting system problem',
  88: 'Mower not able to start',
  89: 'Switch off error',
  90: 'STOP button triggered',
  91: 'Blade disc blocked',
  92: 'Wheel sensor issue right',
  93: 'Wheel sensor issue left',
  94: 'Loop sensor error',
  95: 'Mower has been in a collision',
  96: 'Mower stuck',
  // Add more error codes as they become known
};

/**
 * Gets an error description for a given error code
 * 
 * @param errorCode Error code from mower
 * @returns Human-readable error description or undefined if code is unknown
 */
export function getErrorDescription(errorCode: number): string | undefined {
  return ERROR_CODES[errorCode];
}

/**
 * Categorizes an error as critical or not
 * 
 * @param errorCode Error code from mower
 * @returns True if error is critical, false otherwise
 */
export function isCriticalError(errorCode: number): boolean {
  // These error codes typically require human intervention
  const criticalCodes = [8, 11, 12, 14, 15, 18, 19, 20, 21, 23, 24, 26, 27, 37, 38, 66, 67];
  return criticalCodes.includes(errorCode);
}

export default ERROR_CODES; 