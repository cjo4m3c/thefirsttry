// `Dashboard` was split into `src/components/Dashboard/` (PR-8) to keep
// every file under the 15KB push-rule soft limit. External importers
// (App.jsx) keep working unchanged.
export { default } from './Dashboard/index.jsx';
