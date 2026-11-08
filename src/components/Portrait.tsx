import type { Appearance } from '../social/types'

const COLORS = {
  sage: { background: '#353039', cloth: '#6c6950', light: '#939077', trim: '#bea372' },
  ember: { background: '#3b2c31', cloth: '#925a46', light: '#c08960', trim: '#e3b478' },
  aether: { background: '#2e3043', cloth: '#67628e', light: '#9a91be', trim: '#bdcde1' },
}

export function Portrait({ large = false, appearance = { style: 'hood', palette: 'sage' } }: {
  large?: boolean
  appearance?: Appearance
}) {
  const colors = COLORS[appearance.palette]
  return (
    <svg viewBox="0 0 48 48" className={`portrait ${large ? 'large' : ''}`} aria-hidden="true" shapeRendering="crispEdges">
      <rect width="48" height="48" fill={colors.background} />
      <path d="M8 48V36H12V28H16V12H20V8H32V12H36V28H40V36H44V48Z" fill={colors.cloth} />
      <path d="M16 24V16H20V12H32V16H36V24Z" fill={colors.light} />
      <path d="M20 20H32V32H28V36H24V32H20Z" fill="#b7a081" />
      {appearance.style === 'braids' ? <>
        <path d="M16 12H20V28H16ZM32 12H36V28H32ZM16 28H20V32H16ZM32 28H36V32H32ZM14 32H18V36H14ZM34 32H38V36H34Z" fill="#b88a53" />
        <path d="M20 12H32V16H20Z" fill="#b88a53" />
      </> : appearance.style === 'helm' ? <>
        <path d="M16 16H36V24H16ZM20 12H32V16H20ZM24 24H28V32H24Z" fill="#9a9e9c" />
        <path d="M18 20H34V24H18Z" fill="#343339" />
        <path d="M22 8H30V12H22Z" fill={colors.trim} />
      </> : <path d="M16 20H36V24H16Z" fill="#343339" />}
      <path d="M22 26H24V28H22ZM29 26H31V28H29Z" fill="#e2cf99" />
      <path d="M12 40H40V44H12Z" fill={colors.background} />
      <path d="M26 40H30V44H26Z" fill={colors.trim} />
      <path d="M5 36H9V16H11V10H13V22H11V40H5Z" fill="#b7b9ad" />
    </svg>
  )
}
