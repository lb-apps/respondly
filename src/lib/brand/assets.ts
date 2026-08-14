/** Bump when replacing files under public/brand/ to bust browser caches. */
const BRAND_ASSET_VERSION = "2"

/** Public brand assets (paths are URL paths from site root). */
export const RESPONDLY_LOGO_PATH = `/brand/respondly-logo.png?v=${BRAND_ASSET_VERSION}`
export const RESPONDLY_ICON_PATH = `/brand/respondly-icon.png?v=${BRAND_ASSET_VERSION}`

export const RESPONDLY_BRAND_NAME = "Respondly"

/** Horizontal logo display size in sidebar (height follows 1799×874 aspect ratio). */
export const RESPONDLY_LOGO_SIDEBAR_WIDTH_PX = 112
export const RESPONDLY_LOGO_SIDEBAR_HEIGHT_PX = Math.round(
  RESPONDLY_LOGO_SIDEBAR_WIDTH_PX * (874 / 1799)
)
