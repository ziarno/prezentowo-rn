import { defineConfig } from '@meteorjs/rspack'
import { TsCheckerRspackPlugin } from 'ts-checker-rspack-plugin'

/**
 * Rspack configuration for Meteor projects.
 *
 * Provides typed flags on the `Meteor` object, such as:
 * - `Meteor.isClient` / `Meteor.isServer`
 * - `Meteor.isDevelopment` / `Meteor.isProduction`
 * - …and other flags available
 *
 * Use these flags to adjust your build settings based on environment.
 */
export default defineConfig(Meteor => {
  return {
    plugins: [new TsCheckerRspackPlugin()],
    // sharp loads a native binary, so Node requires it at runtime rather
    // than Rspack bundling it. stream-chat goes the same way: bundling it
    // pulls in ws and debug, whose optional try/catch requires (bufferutil,
    // utf-8-validate, supports-color) Rspack reports as missing modules.
    ...(Meteor.isServer
      ? Meteor.compileWithMeteor(['sharp', 'stream-chat'])
      : {}),
  }
})
