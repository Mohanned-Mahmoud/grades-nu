const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
// Locate the monorepo workspace root (2 directories up from artifacts/mobile)
const workspaceRoot = path.resolve(projectRoot, "../..");

// CRITICAL: Force-define the app root for Expo Router prior to config generation
process.env.EXPO_ROUTER_APP_ROOT = path.resolve(projectRoot, "app");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files across the monorepo workspace
config.watchFolders = [workspaceRoot];

// 2. Instruct Metro where to find package modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Force linear dependency resolution inside nodeModulesPaths
config.resolver.disableHierarchicalLookup = true;

module.exports = config;