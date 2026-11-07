import { useEffect, useRef } from 'react'
import type { Combat, EffectType, Feedback, Room } from '../game/types'

const WIDTH = 320
const HEIGHT = 300
type Point = [number, number]
type Context = CanvasRenderingContext2D

const PALETTES = [
  { sky: '#343037', stone: '#56515c', shadow: '#27252e', moss: '#444c3b', light: '#d4a85b', cloth: '#696447' },
  { sky: '#41282b', stone: '#63504d', shadow: '#2e252c', moss: '#694737', light: '#e8a259', cloth: '#806044' },
  { sky: '#313849', stone: '#687080', shadow: '#282f40', moss: '#485b61', light: '#a9cad0', cloth: '#687b89' },
]
type Palette = typeof PALETTES[number]

function noise(x: number, y: number, seed: number) {
  let value = Math.imul(x + seed, 374761393) ^ Math.imul(y + 17, 668265263)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_295
}

function polygon(context: Context, points: Point[], color: string) {
  const first = points[0]
  if (!first) return
  context.fillStyle = color
  context.beginPath()
  context.moveTo(...first)
  for (const point of points.slice(1)) context.lineTo(...point)
  context.closePath()
  context.fill()
}

function line(context: Context, points: Point[], color: string, width = 1) {
  const first = points[0]
  if (!first) return
  context.strokeStyle = color
  context.lineWidth = width
  context.beginPath()
  context.moveTo(...first)
  for (const point of points.slice(1)) context.lineTo(...point)
  context.stroke()
}

function glow(context: Context, x: number, y: number, radius: number, color: string) {
  const gradient = context.createRadialGradient(x, y, 1, x, y, radius)
  gradient.addColorStop(0, color)
  gradient.addColorStop(1, 'transparent')
  context.fillStyle = gradient
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

function torch(context: Context, x: number, y: number, size = 1) {
  context.save()
  context.translate(x, y)
  context.scale(size, size)
  glow(context, 0, -9, 39, '#df963c48')
  polygon(context, [[-5, 0], [5, 0], [3, 25], [-2, 25]], '#28242a')
  context.fillStyle = '#9a7752'
  context.fillRect(-3, 5, 5, 6)
  polygon(context, [[-7, -2], [-9, -13], [-4, -9], [-2, -24], [3, -17], [7, -21], [9, -8], [5, 1]], '#cd753d')
  polygon(context, [[-4, -1], [-5, -10], [-1, -6], [1, -18], [5, -8], [3, 1]], '#edb45f')
  polygon(context, [[-1, -1], [0, -10], [3, -5], [2, 2]], '#f7df9b')
  context.restore()
}

function dungeon(context: Context, palette: Palette, seed: number) {
  context.fillStyle = '#111319'
  context.fillRect(0, 0, WIDTH, HEIGHT)
  polygon(context, [[0, 0], [320, 0], [210, 108], [110, 108]], palette.shadow)
  polygon(context, [[0, 0], [112, 103], [114, 211], [0, 300]], palette.stone)
  polygon(context, [[320, 0], [208, 103], [206, 211], [320, 300]], palette.stone)
  polygon(context, [[0, 300], [114, 208], [206, 208], [320, 300]], '#39373f')
  glow(context, 160, 155, 88, '#52605d28')

  for (const side of [-1, 1]) {
    context.save()
    if (side === 1) {
      context.translate(320, 0)
      context.scale(-1, 1)
    }
    for (let row = 0; row < 10; row += 1) {
      const outer = -12 + row * 36
      const inner = 106 + (outer - 106) * 0.36
      line(context, [[0, outer], [112, inner]], '#25232c', 2)
      line(context, [[0, outer + 3], [112, inner + 1]], '#80757870')
      for (let block = 0; block < 3; block += 1) {
        const x = 12 + block * 39 + (row % 2) * 14
        const start = outer + (inner - outer) * (x / 112)
        const end = outer + 36 + (inner - outer - 23) * (x / 112)
        line(context, [[x, start], [x, end]], '#292630', 2)
      }
    }
    for (let index = 0; index < 310; index += 1) {
      const x = Math.floor(noise(index, 1, seed) * 109)
      const y = Math.floor(noise(index, 2, seed) * 300)
      const top = x * 0.93
      const bottom = 300 - x * 0.8
      if (y < top || y > bottom) continue
      context.fillStyle = noise(index, 3, seed) > 0.5 ? '#9b92992c' : '#181b2344'
      context.fillRect(x, y, 1 + index % 4, 1 + index % 2)
    }
    line(context, [[38, 29], [44, 48], [39, 60], [48, 76], [43, 96]], '#23222c', 2)
    line(context, [[94, 192], [85, 199], [86, 214], [74, 221]], '#24232c', 2)
    context.restore()
  }

  for (let depth = 0; depth < 6; depth += 1) {
    const y = 214 + depth * depth * 3
    const spread = 30 + (y - 208) * 1.3
    line(context, [[160 - spread, y], [160 + spread, y]], '#201f29', 2)
  }
  for (const x of [-80, 40, 160, 280, 400]) line(context, [[160, 205], [x, 300]], '#22222b')
  for (let row = 0; row < 5; row += 1) {
    line(context, [[row * 30, row * 15], [320 - row * 30, row * 15]], '#161820', 2)
  }

  polygon(context, [[113, 209], [113, 107], [127, 82], [147, 72], [174, 72], [197, 85], [208, 108], [208, 209], [200, 209], [200, 110], [189, 94], [171, 84], [149, 84], [132, 96], [122, 111], [122, 209]], '#48424c')
  for (const [x, y] of [[118, 127], [118, 156], [118, 185], [203, 127], [203, 156], [203, 185]] as const) {
    context.fillStyle = '#262631'
    context.fillRect(x - 5, y, 11, 2)
  }
  torch(context, 43, 131, 1.1)
  torch(context, 275, 131, 1.1)
  glow(context, 160, 225, 80, '#b8996630')
}

function tree(context: Context, x: number, y: number, scale: number, color: string, palette: Palette) {
  context.save()
  context.translate(x, y)
  context.scale(scale, scale)
  polygon(context, [[-9, 0], [-6, -61], [-12, -101], [-4, -137], [2, -117], [5, -74], [12, 0]], color)
  line(context, [[0, -72], [-21, -97], [-28, -130]], color, 5)
  line(context, [[1, -100], [23, -123], [34, -155]], color, 4)
  line(context, [[-16, -92], [-41, -106], [-51, -101]], color, 3)
  polygon(context, [[-62, -101], [-49, -125], [-31, -133], [-8, -162], [14, -161], [35, -145], [58, -123], [45, -109], [14, -122], [-17, -114], [-40, -100]], palette.moss)
  for (let leaf = 0; leaf < 14; leaf += 1) {
    context.fillStyle = leaf % 2 ? '#76694a' : '#8b7751'
    const lx = -42 + noise(leaf, x, 8) * 80
    const ly = -150 + noise(leaf, y, 16) * 40
    context.fillRect(lx, ly, 3, 2)
  }
  context.restore()
}

function overworld(context: Context, palette: Palette, seed: number, floor: number) {
  const sky = context.createLinearGradient(0, 0, 0, 220)
  sky.addColorStop(0, palette.sky)
  sky.addColorStop(0.7, '#71634f')
  sky.addColorStop(1, '#434b43')
  context.fillStyle = sky
  context.fillRect(0, 0, WIDTH, HEIGHT)
  context.fillStyle = floor === 3 ? '#ccd6ca' : '#c8b991'
  context.beginPath()
  context.arc(210, 55, 16, 0, Math.PI * 2)
  context.fill()
  glow(context, 210, 55, 38, '#dfd6b31f')
  polygon(context, [[0, 157], [43, 83], [66, 111], [104, 65], [141, 129], [190, 104], [223, 79], [275, 124], [320, 83], [320, 220], [0, 220]], '#444743')
  polygon(context, [[0, 196], [75, 127], [136, 157], [180, 130], [236, 143], [320, 108], [320, 300], [0, 300]], '#303b35')
  polygon(context, [[120, 183], [200, 183], [272, 300], [51, 300]], '#736954')
  polygon(context, [[140, 182], [174, 182], [221, 300], [96, 300]], '#8a795b')
  for (let index = 0; index < 130; index += 1) {
    context.fillStyle = index % 3 ? '#aaa08630' : '#313b3488'
    context.fillRect(noise(index, 1, seed) * WIDTH, 193 + noise(index, 3, seed) * 107, 3 + index % 5, 2)
  }
  for (let depth = 0; depth < 5; depth += 1) {
    tree(context, 27 + depth * 13, 216 - depth * 10, 0.62 - depth * 0.07, '#333931', palette)
    tree(context, 295 - depth * 12, 219 - depth * 10, 0.65 - depth * 0.07, '#333931', palette)
  }
  tree(context, 12, 294, 1.9, '#22282a', palette)
  tree(context, 313, 298, 1.85, '#22282a', palette)

  context.fillStyle = palette.stone
  context.fillRect(104, 94, 26, 113)
  context.fillRect(191, 94, 26, 113)
  polygon(context, [[103, 95], [111, 60], [134, 43], [186, 43], [209, 60], [217, 95], [191, 95], [183, 74], [170, 66], [149, 66], [134, 78], [130, 95]], palette.stone)
  context.fillStyle = '#202529'
  context.fillRect(133, 94, 56, 107)
  polygon(context, [[133, 96], [141, 79], [152, 71], [169, 71], [181, 80], [189, 96]], '#202529')
  glow(context, 160, 162, 34, '#d2a75e38')
  for (let row = 0; row < 7; row += 1) {
    line(context, [[104, 102 + row * 16], [130, 102 + row * 16]], '#34323a', 2)
    line(context, [[191, 102 + row * 16], [217, 102 + row * 16]], '#34323a', 2)
  }
  for (let step = 0; step < 4; step += 1) {
    context.fillStyle = step % 2 ? '#59575b' : '#79756c'
    context.fillRect(129 - step * 4, 198 + step * 6, 63 + step * 8, 6)
  }
  line(context, [[118, 63], [125, 74], [116, 97], [122, 112], [113, 132], [116, 165]], palette.moss, 4)
  line(context, [[207, 72], [199, 94], [205, 126], [194, 147]], palette.moss, 4)
  torch(context, 120, 152, 0.65)
  torch(context, 201, 152, 0.65)
}

function chest(context: Context, palette: Palette) {
  glow(context, 157, 211, 51, `${palette.light}35`)
  polygon(context, [[103, 225], [121, 169], [199, 169], [217, 225]], '#252129')
  polygon(context, [[119, 177], [125, 164], [192, 164], [202, 177], [202, 190], [119, 190]], '#927044')
  context.fillStyle = '#63482f'
  context.fillRect(119, 191, 83, 37)
  line(context, [[120, 203], [199, 203]], '#a57e494d', 2)
  line(context, [[123, 218], [197, 218]], '#2f2a27', 2)
  for (const x of [126, 183]) {
    context.fillStyle = '#bda367'
    context.fillRect(x, 168, 7, 58)
    context.fillStyle = '#5c5144'
    for (const y of [176, 195, 218]) context.fillRect(x + 2, y, 3, 3)
  }
  context.fillStyle = '#d9be77'
  context.fillRect(155, 187, 12, 16)
  context.fillStyle = '#312c29'
  context.fillRect(159, 191, 4, 7)
  for (const x of [146, 159, 172]) {
    context.fillStyle = palette.light
    context.fillRect(x, 176, 3, 4)
    context.fillRect(x - 2, 179, 7, 2)
  }
  context.fillStyle = '#f2d996'
  context.fillRect(140, 189, 8, 1)
  context.fillRect(170, 189, 8, 1)
}

function pilgrim(context: Context, palette: Palette, shop: boolean) {
  if (shop) {
    polygon(context, [[86, 125], [113, 83], [211, 83], [239, 125]], '#715048')
    polygon(context, [[86, 125], [96, 112], [105, 128], [116, 111], [129, 128], [140, 112], [154, 128], [168, 110], [181, 127], [195, 111], [209, 127], [223, 113], [239, 125]], '#a58d66')
    context.fillStyle = '#493e38'
    context.fillRect(97, 125, 4, 92)
    context.fillRect(224, 125, 4, 92)
  }
  polygon(context, [[135, 144], [128, 182], [122, 228], [180, 230], [185, 185], [173, 145]], palette.cloth)
  polygon(context, [[134, 147], [137, 125], [148, 112], [163, 112], [176, 125], [178, 151], [164, 143], [146, 145]], '#414347')
  polygon(context, [[143, 130], [166, 128], [169, 151], [158, 160], [148, 153]], '#ae9672')
  polygon(context, [[142, 132], [157, 124], [174, 129], [170, 141], [146, 142]], '#353539')
  context.fillStyle = '#d6c29a'
  context.fillRect(150, 143, 3, 2)
  context.fillRect(163, 143, 3, 2)
  line(context, [[139, 167], [130, 202], [148, 216]], '#929077', 3)
  line(context, [[171, 168], [184, 186], [195, 180]], '#929077', 4)
  torch(context, 199, 176, 0.6)
  if (shop) {
    polygon(context, [[91, 210], [226, 210], [222, 237], [96, 237]], '#746045')
    line(context, [[92, 215], [226, 215]], '#b19364', 2)
    for (const [x, color] of [[113, '#a56f59'], [132, '#71959a'], [202, '#a56f59']] as const) {
      context.fillStyle = color
      context.fillRect(x, 192, 9, 16)
      context.fillStyle = '#d1bd89'
      context.fillRect(x + 2, 187, 5, 5)
      context.fillRect(x + 1, 196, 3, 4)
    }
    context.fillStyle = '#c2a467'
    context.fillRect(166, 203, 5, 4)
    context.fillRect(175, 204, 7, 3)
  }
}

function shrine(context: Context, palette: Palette) {
  glow(context, 160, 161, 63, '#a3c8bd3c')
  polygon(context, [[115, 218], [128, 193], [192, 193], [207, 218], [193, 237], [129, 237]], '#60606b')
  polygon(context, [[121, 214], [133, 202], [187, 202], [200, 214], [187, 225], [135, 225]], '#9c9890')
  polygon(context, [[130, 213], [140, 205], [181, 205], [190, 213], [180, 219], [141, 219]], '#688d8d')
  line(context, [[138, 213], [181, 213]], '#abc8bc', 2)
  polygon(context, [[157, 140], [171, 157], [160, 181], [150, 159]], palette.light)
  polygon(context, [[157, 140], [160, 181], [150, 159]], '#a8c5b0')
  context.fillStyle = '#d8e6c9'
  for (const [x, y] of [[144, 148], [179, 181], [138, 188], [174, 132], [165, 197]] as const) context.fillRect(x, y, 2, 2)
}

function creature(context: Context, room: Room, palette: Palette, floor: number, phase: 1 | 2 = 1, heavy = false) {
  const boss = room.kind === 'boss'
  const armored = /sentry|guardian|knight/.test(room.id)
  const size = boss ? (phase === 2 ? 1.35 : 1.25) : room.kind === 'combat' && room.enemy.tough ? 1.16 : 1
  context.save()
  context.translate(160, boss ? 177 : 181)
  context.scale(size, size)
  const flesh = armored ? '#949287' : floor === 2 ? '#9f6349' : '#737b5a'
  glow(context, 0, 16, 48, boss ? '#c7785420' : '#bbaa7320')
  polygon(context, [[-43, 60], [-24, 41], [-24, 12], [-31, -12], [-20, -40], [17, -43], [33, -17], [24, 14], [27, 43], [44, 62]], palette.shadow)
  if (boss && floor === 2) {
    polygon(context, [[-22, -21], [-57, -71], [-77, -35], [-63, -17], [-51, -35], [-40, -4]], '#8b5147')
    polygon(context, [[20, -21], [57, -71], [77, -35], [63, -17], [51, -35], [40, -4]], '#8b5147')
    line(context, [[-22, -21], [-57, -71], [-51, -35]], '#c08659', 2)
    line(context, [[20, -21], [57, -71], [51, -35]], '#c08659', 2)
    if (phase === 2) {
      glow(context, 0, -18, 75, '#d7824540')
      polygon(context, [[-65, -39], [-84, -65], [-72, -57], [-68, -80], [-57, -56], [-44, -62], [-47, -35]], '#d18c48')
      polygon(context, [[65, -39], [84, -65], [72, -57], [68, -80], [57, -56], [44, -62], [47, -35]], '#d18c48')
    }
  }
  polygon(context, [[-23, -16], [-37, 6], [-34, 38], [-43, 47], [-35, 51], [-22, 41], [-24, 11], [-10, -5]], flesh)
  polygon(context, [[21, -17], [35, 6], [30, 27], [45, 32], [45, 38], [25, 39], [20, 18], [12, -6]], flesh)
  polygon(context, [[-14, 18], [-18, 43], [-26, 58], [-16, 62], [-6, 44], [0, 23]], flesh)
  polygon(context, [[6, 19], [12, 44], [23, 58], [33, 58], [21, 39], [18, 17]], flesh)
  polygon(context, [[-17, -29], [-25, -13], [-17, 18], [12, 26], [26, -9], [14, -32]], armored ? '#5d6268' : palette.cloth)
  polygon(context, [[-13, -47], [8, -51], [22, -38], [16, -18], [1, -9], [-17, -20], [-22, -36]], flesh)
  if (!armored && !boss) {
    polygon(context, [[-16, -39], [-35, -46], [-28, -24], [-15, -25]], flesh)
    polygon(context, [[15, -41], [32, -48], [28, -27], [16, -27]], flesh)
  }
  polygon(context, [[-17, -40], [1, -50], [18, -37], [11, -29], [-13, -29]], armored ? '#373b43' : '#414839')
  context.fillStyle = boss ? '#efb264' : '#d2bd79'
  context.fillRect(-12, -29, 6, 3)
  context.fillRect(7, -30, 6, 3)
  context.fillStyle = '#28272c'
  context.fillRect(-6, -20, 13, 3)
  context.fillStyle = '#cec4a4'
  for (let tooth = 0; tooth < 3; tooth += 1) context.fillRect(-5 + tooth * 4, -20, 2, 4)
  if (armored || boss) {
    line(context, [[-15, -11], [0, 2], [19, -10]], '#a09a88', 2)
    line(context, [[-12, 9], [14, 11]], '#a09a88', 2)
  }
  if (boss && floor !== 2 && phase === 1) {
    polygon(context, [[-19, -40], [-25, -65], [-11, -54], [-2, -74], [8, -54], [21, -68], [20, -42]], '#b59859')
    line(context, [[-18, -44], [18, -46]], '#e0c589', 3)
    context.fillStyle = '#b16352'
    context.fillRect(-2, -54, 4, 5)
  }
  if (boss && phase === 2 && floor !== 2) {
    glow(context, 0, -28, 36, floor === 3 ? '#b0a3da35' : '#e5ad7035')
    line(context, [[-18, -38], [-8, -31], [-13, -21]], '#e1c08b', 2)
    line(context, [[14, -40], [6, -34], [13, -20]], '#e1c08b', 2)
  }
  polygon(context, heavy ? [[43, 29], [51, -42], [56, -32], [49, 34]] : [[43, 29], [63, -1], [63, 7], [49, 34]], '#a5aaa7')
  line(context, [[41, 31], [51, 37]], '#a69364', 3)
  context.restore()
}

function sword(context: Context) {
  polygon(context, [[263, 300], [260, 277], [278, 258], [292, 267], [308, 300]], '#41454e')
  polygon(context, [[265, 282], [279, 269], [291, 275], [295, 291], [281, 300], [269, 295]], '#8a8e8e')
  line(context, [[265, 285], [286, 281], [294, 291]], '#c1c3b3', 2)
  line(context, [[268, 292], [285, 287]], '#c1c3b3', 2)
  polygon(context, [[257, 270], [267, 279], [280, 258], [269, 251]], '#74604a')
  line(context, [[263, 266], [272, 271]], '#c2ae77', 2)
  polygon(context, [[269, 252], [285, 202], [303, 163], [294, 210], [279, 258]], '#b0b4ae')
  polygon(context, [[269, 252], [285, 202], [303, 163], [276, 255]], '#d5d6c4')
  line(context, [[276, 251], [303, 163]], '#858c90')
  polygon(context, [[253, 247], [267, 249], [283, 258], [296, 256], [294, 263], [281, 265], [265, 255], [253, 254]], '#ab986a')
  line(context, [[253, 247], [267, 249], [284, 259]], '#e0c991', 2)
  context.fillStyle = '#c2a777'
  context.fillRect(256, 282, 9, 8)
  context.fillStyle = '#9a5d4c'
  context.fillRect(258, 284, 5, 4)
}

function dither(context: Context, seed: number, height: number) {
  const image = context.getImageData(0, 0, WIDTH, height)
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const index = (y * WIDTH + x) * 4
      const grain = (noise(x, y, seed) - 0.5) * 25
      const threshold = ((bayer[(y % 4) * 4 + x % 4] ?? 0) / 16 - 0.5) * 14
      const vignette = Math.max(0, Math.abs(x - 160) / 160 - 0.55) * 18
      for (let channel = 0; channel < 3; channel += 1) {
        const value = (image.data[index + channel] ?? 0) + grain + threshold - vignette
        image.data[index + channel] = Math.round(Math.max(0, Math.min(255, value)) / 8) * 8
      }
    }
  }
  context.putImageData(image, 0, 0)
}

function backdrop(context: Context, room: Room, floor: number, seed: number, height: number) {
  const palette = PALETTES[floor - 1]
  if (!palette) throw new Error(`No artwork palette exists for floor ${floor}.`)
  context.imageSmoothingEnabled = false
  context.save()
  context.scale(1, height / HEIGHT)
  if (room.zone === 'overworld') overworld(context, palette, seed, floor)
  else dungeon(context, palette, seed)
  context.restore()
  dither(context, seed, height)
}

const EFFECT_COLORS: Partial<Record<EffectType, string>> = {
  ember: '#e5ad70', frost: '#a8cedb', storm: '#bcb0df', ward: '#9daed4',
  heal: '#b4c7a0', phase: '#e1c08b', secret: '#bcb0df', reveal: '#e1c08b', victory: '#e1c08b',
}

function castingHand(context: Context, height: number, color: string, progress: number) {
  context.save()
  context.translate(0, -Math.sin(progress * Math.PI) * 7)
  polygon(context, [[15, height], [21, height - 27], [33, height - 41], [47, height - 44], [57, height - 37], [63, height - 20], [55, height]], '#747a83')
  line(context, [[23, height - 24], [47, height - 30], [57, height - 22]], '#bec5bd', 2)
  line(context, [[32, height - 40], [35, height - 29]], '#d2d4c5', 2)
  glow(context, 44, height - 52, 23, `${color}70`)
  context.fillStyle = color
  context.fillRect(39, height - 58, 10, 10)
  context.fillRect(36, height - 55, 16, 4)
  context.restore()
}

function spellEffect(context: Context, type: EffectType, progress: number, height: number) {
  const color = EFFECT_COLORS[type]
  if (!color || progress >= 1) return
  const targetY = height * 0.42
  context.save()
  context.globalAlpha = Math.min(1, (1 - progress) * 2.8)
  if (type === 'ember' || type === 'frost' || type === 'storm' || type === 'ward' || type === 'heal') {
    castingHand(context, height, color, progress)
  }
  const impact = Math.min(1, progress * 2.5)
  if (type === 'ember' || type === 'frost') {
    const x = 44 + 116 * impact
    const y = height - 52 + (targetY - height + 52) * impact
    glow(context, x, y, 24, `${color}65`)
    context.fillStyle = color
    context.fillRect(x - 5, y - 5, 10, 10)
    for (let index = 0; index < 24; index += 1) {
      const angle = index * 2.4
      const distance = (progress > 0.38 ? (progress - 0.38) * 78 : index * 0.6)
      const px = x + Math.cos(angle) * distance
      const py = y + Math.sin(angle) * distance * 0.7
      context.fillRect(px, py, index % 3 === 0 ? 4 : 2, type === 'frost' ? 4 : 2)
    }
  } else if (type === 'storm') {
    const points: Point[] = [[44, height - 52]]
    for (let index = 1; index <= 7; index += 1) {
      const part = index / 7
      points.push([44 + 116 * part + (index % 2 ? -9 : 8), height - 52 + (targetY - height + 52) * part])
    }
    line(context, points, color, 4)
    line(context, points, '#d9e0ed', 1)
    glow(context, 160, targetY, 34, '#bcb0df50')
  } else {
    const centerY = type === 'ward' || type === 'heal' ? height - 54 : targetY + 12
    const radius = 12 + progress * 58
    for (let index = 0; index < 32; index += 1) {
      const angle = index * Math.PI / 16 + progress
      const x = 160 + Math.cos(angle) * radius
      const y = centerY + Math.sin(angle) * radius * 0.55
      context.fillStyle = color
      context.fillRect(x, y, 2 + index % 2, 2 + index % 2)
    }
    glow(context, 160, centerY, radius + 8, `${color}25`)
  }
  context.restore()
}

function combatConditions(context: Context, combat: Combat | null, height: number, time: number) {
  if (!combat || combat.result !== 'fighting') return
  const shift = (height - HEIGHT) * 0.66
  if (combat.frozenTurns > 0) {
    glow(context, 160, 165 + shift, 48, '#a8cedb25')
    for (const [x, y] of [[125, 156], [143, 194], [184, 150], [192, 204]] as const) {
      polygon(context, [[x - 7, y + shift + 15], [x, y + shift - 12], [x + 6, y + shift + 15]], '#91b2c4')
      line(context, [[x, y + shift - 10], [x + 3, y + shift + 12]], '#c0dce1')
    }
  }
  if (combat.burnTurns > 0) {
    for (let index = 0; index < 12; index += 1) {
      context.fillStyle = index % 2 ? '#e5ad70' : '#bd784e'
      const y = 219 + shift - (time * 19 + index * 9) % 67
      context.fillRect(131 + noise(index, 2, 8) * 58, y, 2, 3)
    }
  }
  if (combat.ward > 0) {
    const points: Point[] = []
    for (let index = 0; index <= 24; index += 1) {
      const angle = index * Math.PI / 12
      points.push([163 + Math.cos(angle) * 72, height - 41 + Math.sin(angle) * 25])
    }
    line(context, points, '#8fa7c688', 1)
    glow(context, 160, height - 37, 54, '#8fa7c614')
  }
}

function renderFrame(
  context: Context, background: HTMLCanvasElement, room: Room, floor: number,
  seed: number, height: number, known: boolean, combat: Combat | null,
  feedback: Feedback | null, time: number, progress: number, reduced: boolean,
) {
  const palette = PALETTES[floor - 1]
  if (!palette) throw new Error(`No artwork palette exists for floor ${floor}.`)
  context.clearRect(0, 0, WIDTH, height)
  context.save()
  const shake = !reduced && feedback && progress < 1 && feedback.playerDamage > 0
    ? Math.sin(progress * 22) * (1 - progress) * 2 : 0
  context.translate(shake, 0)
  context.drawImage(background, 0, 0)
  context.save()
  context.scale(1, height / HEIGHT)
  const flicker = reduced ? 0 : Math.sin(time * 2.3) * 0.035
  if (room.zone === 'dungeon') {
    torch(context, 43, 131, 1.1 + flicker)
    torch(context, 275, 131, 1.1 - flicker)
  } else {
    torch(context, 120, 152, 0.65 + flicker)
    torch(context, 201, 152, 0.65 - flicker)
  }
  context.restore()
  context.save()
  context.translate(0, (height - HEIGHT) * 0.66)
  if (!reduced) context.translate(Math.sin(time * 1.3) * 0.8, Math.cos(time * 1.8) * 0.8)
  if (room.kind === 'treasure') chest(context, palette)
  if (room.kind === 'npc' || room.kind === 'shop') pilgrim(context, palette, room.kind === 'shop')
  if (room.kind === 'shrine') shrine(context, palette)
  if (room.kind === 'combat' || room.kind === 'boss') {
    const actorScale = Math.min(1, Math.max(0.6, (height - 45) / 160))
    context.translate(0, height * 0.6 - (177 + (height - HEIGHT) * 0.66))
    context.translate(160, 177)
    context.scale(actorScale, actorScale)
    context.translate(-160, -177)
    context.globalAlpha = known ? (combat?.result === 'victory' ? reduced ? 0.2 : Math.max(0.2, 1 - progress * 1.5) : 1) : 0.13
    if (!reduced && feedback && progress < 0.35 && feedback.enemyDamage > 0) context.translate(-Math.sin(progress * 18) * 3, 0)
    creature(context, room, palette, floor, combat?.phase ?? 1, combat?.intent === 'heavy')
    if (!known) {
      context.globalAlpha = 0.75
      context.fillStyle = '#d8bf82'
      context.fillRect(148, 149, 3, 2)
      context.fillRect(167, 148, 3, 2)
    }
  }
  context.restore()
  combatConditions(context, combat, height, reduced ? 0 : time)
  if (!reduced) {
    for (let index = 0; index < 28; index += 1) {
      const x = (noise(index, 2, seed) * WIDTH + Math.sin(time * 0.3 + index) * 5 + WIDTH) % WIDTH
      const y = (noise(index, 5, seed) * height - time * (2 + index % 3) + height * 10) % height
      context.fillStyle = index % 5 === 0 ? '#cbb28250' : '#b0b6ae15'
      context.fillRect(x, y, index % 3 ? 1 : 2, 1)
    }
  }
  if (!known) {
    context.save()
    context.globalAlpha = 0.2
    for (let index = 0; index < 9; index += 1) {
      const x = -30 + (index * 49 + (reduced ? 0 : time * 7)) % 370
      glow(context, x, height * 0.58 + Math.sin(index) * 20, 58, '#74788390')
    }
    context.restore()
  }
  context.save()
  const weaponScale = Math.min(1, height / 180)
  context.translate(280, height)
  context.scale(weaponScale, weaponScale)
  context.translate(-280, -HEIGHT)
  const actionType = feedback?.actionType === 'info' ? feedback.type : feedback?.actionType
  if (!reduced && feedback && progress < 1) {
    if (actionType === 'strike') {
      const swing = Math.sin(Math.min(1, progress * 1.8) * Math.PI)
      context.translate(276, 271)
      context.rotate(-swing * 0.85)
      context.translate(-276 - swing * 18, -271 - swing * 8)
    } else if (actionType === 'dodge') {
      context.translate(Math.sin(progress * Math.PI) * 19, 0)
    } else if (actionType === 'guard') {
      context.translate(-Math.sin(progress * Math.PI) * 11, -Math.sin(progress * Math.PI) * 13)
    }
  }
  sword(context)
  context.restore()
  if (!reduced && feedback && progress < 1) {
    if (actionType) spellEffect(context, actionType, progress, height)
    if (feedback.type !== actionType) spellEffect(context, feedback.type, progress, height)
    context.save()
    context.globalAlpha = Math.min(1, (1 - progress) * 3)
    context.font = '12px "DM Mono", monospace'
    context.textAlign = 'center'
    if (feedback.enemyDamage > 0) {
      const y = height * 0.32 - progress * 20
      context.fillStyle = '#17171d'
      context.fillText(`-${feedback.enemyDamage}`, 161, y + 1)
      context.fillStyle = '#f1d29e'
      context.fillText(`-${feedback.enemyDamage}`, 160, y)
    }
    if (feedback.healing > 0 || feedback.playerDamage > 0) {
      context.fillStyle = feedback.healing > 0 ? '#c6d7b2' : '#e5a497'
      context.fillText(`${feedback.healing > 0 ? '+' : '-'}${feedback.healing || feedback.playerDamage} HP`, 63, Math.max(28, height - 58) - progress * 16)
    }
    context.restore()
  }
  context.restore()
}

export function PixelScene({ room, floor, seed, known = true, combat = null, feedback = null, reducedMotion = false, paused = false }: {
  room: Room
  floor: number
  seed: number
  known?: boolean
  combat?: Combat | null
  feedback?: Feedback | null
  reducedMotion?: boolean
  paused?: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const live = useRef({ known, combat, feedback })
  const effect = useRef<{ feedback: Feedback; started: number } | null>(null)
  const redraw = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (feedback && feedback.id !== live.current.feedback?.id) {
      effect.current = { feedback, started: performance.now() }
    }
    live.current = { known, combat, feedback }
    if (reducedMotion || paused) redraw.current?.()
  }, [known, combat, feedback, reducedMotion, paused])
  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!context) throw new Error('The browser could not create the dungeon artwork. Enable canvas rendering and reload.')
    if (!element) throw new Error('The dungeon scene is missing its canvas.')
    const background = document.createElement('canvas')
    background.width = WIDTH
    const backgroundContext = background.getContext('2d')
    if (!backgroundContext) throw new Error('The browser could not cache the dungeon background.')
    let height = 0
    let animation = 0
    let lastFrame = 0
    const still = reducedMotion || paused
    const draw = (now: number) => {
      const current = live.current
      const active = effect.current
      const progress = active ? Math.min(1, (now - active.started) / 750) : 1
      renderFrame(context, background, room, floor, seed, height, current.known, current.combat, active?.feedback ?? null, now / 1000, progress, still)
    }
    const resize = () => {
      const bounds = element.getBoundingClientRect()
      const nextHeight = Math.max(100, Math.round(WIDTH * bounds.height / Math.max(1, bounds.width)))
      if (height !== nextHeight) {
        height = nextHeight
        element.height = height
        background.height = height
        backdrop(backgroundContext, room, floor, seed, height)
      }
      draw(performance.now())
    }
    const tick = (now: number) => {
      if (document.hidden) { animation = 0; return }
      if (now - lastFrame >= 50) { draw(now); lastFrame = now }
      animation = requestAnimationFrame(tick)
    }
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(animation); animation = 0 }
      else if (!still && animation === 0) animation = requestAnimationFrame(tick)
    }
    redraw.current = () => draw(performance.now())
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    if (!still && !document.hidden) animation = requestAnimationFrame(tick)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(animation)
      document.removeEventListener('visibilitychange', visibility)
      redraw.current = null
    }
  }, [room, floor, seed, reducedMotion, paused])
  return (
    <canvas
      ref={canvas}
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label={`${known ? room.name : 'An unidentified presence'}: an original pixel-art ${room.zone === 'overworld' ? 'woodland path' : 'torchlit dungeon'}, seen from behind your sword.`}
      className="pixel-scene"
      data-motion={reducedMotion ? 'reduced' : paused ? 'paused' : 'animated'}
    />
  )
}
