export enum SparePartState {
  NEW = "NEW",
  USED = "USED",
  REPAIRED = "REPAIRED",
  BROKEN = "BROKEN",
}

export enum ConsumableState {
  EXHAUSTED = "EXHAUSTED",
}

export enum AnalyzerState {
  OPERATIONAL = "OPERATIONAL", // Functioning normally
  STARTUP = "STARTUP", // In startup process
  MAINTENANCE = "MAINTENANCE", // Under maintenance
  CALIBRATION = "CALIBRATION", // Being calibrated
  FAULT = "FAULT", // Error condition
  SHUTDOWN = "SHUTDOWN", // Powered down
  OUT_OF_SERVICE = "OUT_OF_SERVICE", // Long-term inactive
}
