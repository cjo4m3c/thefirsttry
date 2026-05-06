// Backward-compat shim. Real implementation lives in ./excelImport/index.js.
// Existing imports `from '../utils/excelImport.js'` keep working unchanged.
// Split (PR 2026-05-06): see ./excelImport/{aux,detectors,validators,warnings,buildFlow}.js
export { parseExcelToFlow, parseFlowAnnotations } from './excelImport/index.js';
