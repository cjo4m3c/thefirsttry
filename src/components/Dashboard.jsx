// Backward-compat shim. Real implementation lives in ./Dashboard/index.jsx.
// Existing imports `from './Dashboard.jsx'` keep working unchanged.
// Split (PR 2026-05-06): see ./Dashboard/{Banners,BulkToolbar,FlowCard,DuplicateImportModal,sortFlows}.jsx
export { default } from './Dashboard/index.jsx';
